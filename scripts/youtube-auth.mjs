// YouTube 업로드 권한 연결 (로컬에서 한 번만 실행)
// 1) Google Cloud 에서 받은 OAuth 클라이언트 파일(데스크톱 앱)을 프로젝트 폴더에 yt-client.json 으로 저장
// 2) node scripts/youtube-auth.mjs → 브라우저에서 YouTube 채널 계정으로 허용
// 3) 받은 refresh token 과 클라이언트 정보를 GitHub Secrets 에 바로 등록 (화면/로그에 값을 출력하지 않음)
import fs from 'node:fs';
import http from 'node:http';
import { execFileSync, spawn } from 'node:child_process';

const FILE = process.argv[2] || 'yt-client.json';
if (!fs.existsSync(FILE)) { console.error(`${FILE} 이 없습니다. Google Cloud 에서 받은 OAuth 클라이언트 JSON 을 이 이름으로 저장하세요.`); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const c = raw.installed || raw.web;
if (!c?.client_id || !c?.client_secret) { console.error('클라이언트 JSON 형식이 아닙니다 (installed.client_id 필요)'); process.exit(1); }

const server = http.createServer();
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const redirect = `http://127.0.0.1:${server.address().port}`;
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: c.client_id, redirect_uri: redirect, response_type: 'code',
  scope: 'https://www.googleapis.com/auth/youtube.upload',
  access_type: 'offline', prompt: 'consent', // refresh token 을 확실히 받기 위해
});
console.log('\n브라우저에서 YouTube 채널 계정으로 로그인하고 "허용"을 누르세요.');
console.log('창이 자동으로 안 열리면 아래 주소를 복사해서 여세요:\n\n' + url + '\n');
try { spawn('cmd.exe', ['/c', 'start', '', url.replace(/&/g, '^&')], { detached: true, stdio: 'ignore' }).unref(); } catch {}

const code = await new Promise((resolve, reject) => {
  server.on('request', (req, res) => {
    const q = new URL(req.url, redirect).searchParams;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    if (q.get('code')) { res.end('<h2>완료! 이 창을 닫고 Claude 로 돌아가세요.</h2>'); resolve(q.get('code')); }
    else { res.end('<h2>허용되지 않았습니다: ' + (q.get('error') || '') + '</h2>'); reject(new Error(q.get('error') || 'no code')); }
  });
  setTimeout(() => reject(new Error('시간 초과 (10분)')), 600000);
});
server.close();

const tok = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  body: new URLSearchParams({ code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirect, grant_type: 'authorization_code' }),
})).json();
if (!tok.refresh_token) { console.error('refresh token 을 받지 못했습니다:', JSON.stringify(tok).slice(0, 200)); process.exit(1); }

// GitHub Secrets 등록 (값은 stdin 으로 전달 → 출력되지 않음)
for (const [name, value] of [['YT_CLIENT_ID', c.client_id], ['YT_CLIENT_SECRET', c.client_secret], ['YT_REFRESH_TOKEN', tok.refresh_token]]) {
  execFileSync('gh', ['secret', 'set', name], { input: value, stdio: ['pipe', 'ignore', 'inherit'] });
  console.log(`GitHub secret 등록: ${name}`);
}
console.log('\n완료. yt-client.json 은 이제 지워도 됩니다.');
