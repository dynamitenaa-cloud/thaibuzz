// 새로 발행된 글을 Facebook 페이지에 링크 게시물로 자동 포스팅 (Graph API, 무료)
// 필요: FB_PAGE_ID, FB_PAGE_TOKEN (시크릿이 없으면 조용히 건너뜀). `--dry` 는 게시 없이 문구만 출력
import fs from 'node:fs';
import path from 'node:path';
import { loadLedger, saveLedger } from './lib/posted.mjs';
import { trackUsage, overLimit } from './lib/meta-usage.mjs';

const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const DRY = process.argv.includes('--dry');
const API = 'https://graph.facebook.com/v25.0';

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
// 이미 올린 글은 건너뜀 (재실행/테스트로 중복 게시 방지). FB_FORCE=true 면 다시 게시
const ledger = loadLedger(slugs);
const FORCE = process.env.FB_FORCE === 'true';
for (const slug of slugs) {
  if (overLimit('facebook')) break;
  if (!FORCE && ledger.photo[slug]) { console.log(`facebook: already posted → skip ${slug}`); continue; }
  const p = JSON.parse(fs.readFileSync(path.join('content', 'posts', `${slug}.json`), 'utf8'));
  const url = `${SITE}/post/${slug}/`;
  // 사진 게시물이 링크 게시물보다 도달률이 높음 → 썸네일을 사진으로 올리고 본문에 링크를 넣는다.
  // 링크는 캡션 안에서도 클릭 가능. 썸네일이 없는(오래된/lite) 글만 링크 게시물로.
  const image = p.thumb ? `${SITE}${p.thumb}` : '';
  const message = `${p.title}

${p.excerpt}

👉 อ่านต่อ: ${url}

${p.tags.slice(0, 3).map(hashtag).join(' ')}`;
  if (DRY) { console.log(`--- ${image ? 'PHOTO' : 'LINK'} ${url}
${message}
`); continue; }
  if (!(await waitLive(url)) || (image && !(await waitLive(image)))) { console.warn(`facebook: ${url} 아직 열리지 않음 → 건너뜀`); failed++; continue; }
  const body = image
    ? new URLSearchParams({ url: image, caption: message, access_token: TOKEN })
    : new URLSearchParams({ message, link: url, access_token: TOKEN });
  const r = await fetch(`${API}/${PAGE_ID}/${image ? 'photos' : 'feed'}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  });
  trackUsage(r);
  const j = await r.json().catch(() => ({}));
  const id = j.post_id || j.id;
  if (r.ok && id) { console.log(`facebook: posted ${image ? 'photo' : 'link'} ${id} ← ${slug}`); ledger.photo[slug] = Date.now(); saveLedger(ledger); }
  else { failed++; console.error(`facebook: FAILED ${slug}:`, JSON.stringify(j.error ?? j).slice(0, 300)); }
  await sleep(3000); // 연속 게시 간격 (스팸 판정 방지)
}
// 토큰 만료(190)/권한 오류는 실패로 표시 → GitHub 알림. 단 사이트 배포 자체는 이미 끝난 뒤라 영향 없음
if (failed) process.exitCode = 1;
