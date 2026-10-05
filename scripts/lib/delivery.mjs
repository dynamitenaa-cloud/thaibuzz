// 영상 추가 배포 채널
//  - Telegram: TikTok 반자동용. 완성된 영상 + 캡션을 내 텔레그램으로 보냄 → 폰에서 저장 후 TikTok 앱에서 음악 붙여 직접 게시
//    (TikTok 자동 게시 API 는 사람이 게시 화면에서 고르는 앱을 전제로 검수 → 완전 자동 봇은 통과가 어려움)
//  - YouTube Shorts: 업로드 API (OAuth refresh token). API 검수 승인 전 업로드는 비공개로 잠기므로 YT_UPLOAD=true 일 때만 동작
import fs from 'node:fs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Telegram ──
export const telegramReady = () => !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) && process.env.TELEGRAM !== 'false';

export async function sendTelegramVideo(file, caption) {
  const form = new FormData();
  form.append('chat_id', process.env.TELEGRAM_CHAT_ID);
  form.append('caption', [...caption].slice(0, 1000).join('')); // 캡션 1024자 제한
  form.append('supports_streaming', 'true');
  form.append('video', new Blob([fs.readFileSync(file)], { type: 'video/mp4' }), 'thaibuzz.mp4');
  const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendVideo`, { method: 'POST', body: form });
  const j = await r.json().catch(() => ({}));
  if (!j.ok) throw new Error('telegram: ' + JSON.stringify(j).slice(0, 200));
  return j.result?.message_id;
}

// ── YouTube Shorts ──
// 무료 한도: 하루 10,000 단위, 업로드 1회 = 1,600 단위 → 하루 최대 6개 (안전하게 기본 5)
export const YT_DAILY_MAX = Number(process.env.YT_DAILY_MAX || 5);
export const youtubeReady = () =>
  process.env.YT_UPLOAD === 'true' && !!(process.env.YT_CLIENT_ID && process.env.YT_CLIENT_SECRET && process.env.YT_REFRESH_TOKEN);

async function ytAccessToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({
      client_id: process.env.YT_CLIENT_ID, client_secret: process.env.YT_CLIENT_SECRET,
      refresh_token: process.env.YT_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!j.access_token) throw new Error('youtube token: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

export async function uploadShort(file, { title, description, tags }) {
  const token = await ytAccessToken();
  const meta = {
    // 제목 100자 제한. #Shorts 는 세로 60초 이하 영상이면 없어도 Shorts 로 분류되지만 명시
    snippet: { title: [...`${title} #Shorts`].slice(0, 100).join(''), description: [...description].slice(0, 4900).join(''), tags: tags.slice(0, 10), categoryId: '25', defaultLanguage: 'th' },
    status: { privacyStatus: 'public', selfDeclaredMadeForKids: false },
  };
  const size = fs.statSync(file).size;
  // 재개 가능 업로드: 세션 생성 → 바이트 전송
  const init = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json; charset=UTF-8', 'x-upload-content-type': 'video/mp4', 'x-upload-content-length': String(size) },
    body: JSON.stringify(meta),
  });
  const loc = init.headers.get('location');
  if (!loc) throw new Error('youtube init: ' + (await init.text()).slice(0, 300));
  for (let attempt = 0; attempt < 3; attempt++) {
    const up = await fetch(loc, { method: 'PUT', headers: { Authorization: `Bearer ${token}`, 'content-type': 'video/mp4' }, body: fs.readFileSync(file) });
    if (up.ok) return (await up.json()).id;
    if (up.status < 500) throw new Error('youtube upload: ' + (await up.text()).slice(0, 300));
    await sleep(5000 * (attempt + 1));
  }
  throw new Error('youtube upload: retries exhausted');
}
