// 새로 발행된 글을 Facebook 페이지에 링크 게시물로 자동 포스팅 (Graph API, 무료)
// 필요: FB_PAGE_ID, FB_PAGE_TOKEN (시크릿이 없으면 조용히 건너뜀). `--dry` 는 게시 없이 문구만 출력
import fs from 'node:fs';
import path from 'node:path';

const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const DRY = process.argv.includes('--dry');
const API = 'https://graph.facebook.com/v23.0';

if (!DRY && (!PAGE_ID || !TOKEN)) { console.log('facebook: FB_PAGE_ID/FB_PAGE_TOKEN 없음 → 건너뜀'); process.exit(0); }
if (!SITE) { console.log('facebook: SITE_URL 없음 → 건너뜀'); process.exit(0); }

const file = '.cache/new-urls.txt';
if (!fs.existsSync(file)) process.exit(0);
const slugs = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((p) => p.split('/').filter(Boolean).pop());

const hashtag = (t) => '#' + t.replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 배포 직후엔 CDN 전파/OG 크롤링 때문에 링크 미리보기가 비는 경우가 있어 페이지가 열릴 때까지 대기
async function waitLive(url) {
  for (let i = 0; i < 12; i++) {
    try { if ((await fetch(url, { method: 'HEAD' })).ok) return true; } catch {}
    await sleep(5000);
  }
  return false;
}

let failed = 0;
for (const slug of slugs) {
  const p = JSON.parse(fs.readFileSync(path.join('content', 'posts', `${slug}.json`), 'utf8'));
  const url = `${SITE}/post/${slug}/`;
  const message = `${p.title}\n\n${p.excerpt}\n\n${p.tags.slice(0, 3).map(hashtag).join(' ')}`;
  if (DRY) { console.log(`--- ${url}\n${message}\n`); continue; }
  if (!(await waitLive(url))) { console.warn(`facebook: ${url} 아직 열리지 않음 → 건너뜀`); failed++; continue; }
  const r = await fetch(`${API}/${PAGE_ID}/feed`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ message, link: url, access_token: TOKEN }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.id) console.log(`facebook: posted ${j.id} ← ${slug}`);
  else { failed++; console.error(`facebook: FAILED ${slug}:`, JSON.stringify(j.error ?? j).slice(0, 300)); }
  await sleep(3000); // 연속 게시 간격 (스팸 판정 방지)
}
// 토큰 만료(190)/권한 오류는 실패로 표시 → GitHub 알림. 단 사이트 배포 자체는 이미 끝난 뒤라 영향 없음
if (failed) process.exitCode = 1;
