// 새 글 → 세로 숏폼 영상 생성 → Facebook Reels 게시 (Graph API, 무료)
// 대상: .cache/new-urls.txt (run-pipeline 이 기록). 영상은 .cache/reels 에 만들고 올린 뒤 삭제 (저장소에 안 쌓음)
// `--dry` : 영상만 만들고 게시 안 함.  REELS=false 면 건너뜀
import fs from 'node:fs';
import path from 'node:path';
import { makeReel } from './lib/video.mjs';

const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const DRY = process.argv.includes('--dry');
const API = 'https://graph.facebook.com/v25.0';

if (process.env.REELS === 'false') { console.log('reels: REELS=false → 건너뜀'); process.exit(0); }
if (!DRY && (!PAGE_ID || !TOKEN)) { console.log('reels: FB_PAGE_ID/FB_PAGE_TOKEN 없음 → 건너뜀'); process.exit(0); }

// lib/site.ts 의 CATEGORIES 색과 동일
const CAT_COLOR = { 'บันเทิง': '#e11d48', 'ซีรีส์/หนัง': '#7c3aed', 'โซเชียล/ไวรัล': '#0ea5e9', 'ข่าวทั่วไป': '#475569', 'กีฬา': '#16a34a', 'ไลฟ์สไตล์': '#f59e0b' };
const hashtag = (t) => '#' + t.replace(/[^\p{L}\p{M}\p{N}]/gu, '');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function graph(pathname, params) {
  const r = await fetch(`${API}/${pathname}`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: TOKEN }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(JSON.stringify(j.error ?? j).slice(0, 300));
  return j;
}

async function publishReel(file, description) {
  // 1) 업로드 세션 시작
  const { video_id, upload_url } = await graph(`${PAGE_ID}/video_reels`, { upload_phase: 'start' });
  // 2) 영상 바이너리 전송
  const buf = fs.readFileSync(file);
  const up = await fetch(upload_url, { method: 'POST', headers: { Authorization: `OAuth ${TOKEN}`, offset: '0', file_size: String(buf.length) }, body: buf });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || !uj.success) throw new Error('upload: ' + JSON.stringify(uj).slice(0, 300));
  // 3) 게시
  await graph(`${PAGE_ID}/video_reels`, { upload_phase: 'finish', video_id, video_state: 'PUBLISHED', description });
  // 4) 처리 상태 확인 (최대 약 2분). 처리 중이어도 페이스북이 이어서 게시하므로 실패로 보지 않음
  for (let i = 0; i < 12; i++) {
    await sleep(10000);
    const s = await (await fetch(`${API}/${video_id}?fields=status&access_token=${TOKEN}`)).json().catch(() => ({}));
    const st = s.status?.video_status;
    if (st === 'ready' || st === 'published') return { video_id, status: st };
    if (st === 'error') throw new Error('processing error: ' + JSON.stringify(s.status).slice(0, 300));
  }
  return { video_id, status: 'processing' };
}

const listFile = '.cache/new-urls.txt';
if (!fs.existsSync(listFile)) process.exit(0);
const slugs = fs.readFileSync(listFile, 'utf8').split('\n').filter(Boolean).map((p) => p.split('/').filter(Boolean).pop());

let failed = 0;
for (const slug of slugs) {
  const p = JSON.parse(fs.readFileSync(path.join('content', 'posts', `${slug}.json`), 'utf8'));
  if (!p.summary?.length) continue;
  try {
    const reel = await makeReel(p, CAT_COLOR[p.category]);
    console.log(`reels: rendered ${slug} (${(reel.size / 1e6).toFixed(1)}MB, ${reel.duration.toFixed(1)}s)`);
    if (DRY) continue;
    const description = `${p.title}\n\n👉 อ่านต่อ: ${SITE}/post/${slug}/\n\n${p.tags.slice(0, 4).map(hashtag).join(' ')} #ข่าววันนี้`;
    const r = await publishReel(reel.file, description);
    console.log(`reels: posted ${r.video_id} [${r.status}] ← ${slug}`);
    fs.rmSync(reel.file, { force: true });
  } catch (e) {
    failed++;
    console.error(`reels: FAILED ${slug}:`, e.message);
  }
}
if (failed) process.exitCode = 1;
