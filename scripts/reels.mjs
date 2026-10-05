// 새 글 → 세로 숏폼 영상 생성 → Facebook Reels 게시 (Graph API, 무료)
// 대상: .cache/new-urls.txt (run-pipeline 이 기록). 영상은 .cache/reels 에 만들고 올린 뒤 삭제 (저장소에 안 쌓음)
// `--dry` : 영상만 만들고 게시 안 함.  REELS=false 면 건너뜀
import fs from 'node:fs';
import path from 'node:path';
import { makeReel, narrationSegments, REEL_DIR } from './lib/video.mjs';
import { narrate } from './lib/tts.mjs';
import { trackUsage, overLimit } from './lib/meta-usage.mjs';
import { telegramReady, sendTelegramVideo, youtubeReady, uploadShort, YT_DAILY_MAX } from './lib/delivery.mjs';
import { loadLedger, saveLedger } from './lib/posted.mjs';

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
  trackUsage(r);
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
  for (let i = 0; i < 8; i++) {
    await sleep(15000);
    const sr = await fetch(`${API}/${video_id}?fields=status&access_token=${TOKEN}`); trackUsage(sr);
    const s = await sr.json().catch(() => ({}));
    const st = s.status?.video_status;
    if (st === 'ready' || st === 'published') return { video_id, status: st };
    if (st === 'error') throw new Error('processing error: ' + JSON.stringify(s.status).slice(0, 300));
  }
  return { video_id, status: 'processing' };
}

const listFile = '.cache/new-urls.txt';
if (!fs.existsSync(listFile)) process.exit(0);
const slugs = fs.readFileSync(listFile, 'utf8').split('\n').filter(Boolean).map((p) => p.split('/').filter(Boolean).pop());

// ── 인스타그램 Reels (같은 영상 재사용) ──
// 페이지에 연결된 인스타 프로페셔널 계정을 자동으로 찾음. 연결이 없거나 권한이 없으면 조용히 건너뜀
async function findIgUser() {
  if (process.env.IG_REELS === 'false' || DRY) return null;
  try {
    const j = await (await fetch(`${API}/${PAGE_ID}?fields=instagram_business_account&access_token=${TOKEN}`)).json();
    return j.instagram_business_account?.id ?? null;
  } catch { return null; }
}

// 업로드형(resumable) 게시: 영상 공개 URL 없이 바이너리를 직접 전송
async function publishIgReel(igId, file, caption) {
  const c = await graph(`${igId}/media`, { media_type: 'REELS', upload_type: 'resumable', caption, share_to_feed: 'true' });
  const buf = fs.readFileSync(file);
  const uploadUrl = c.uri || `https://rupload.facebook.com/ig-api-upload/v25.0/${c.id}`;
  const up = await fetch(uploadUrl, { method: 'POST', headers: { Authorization: `OAuth ${TOKEN}`, offset: '0', file_size: String(buf.length) }, body: buf });
  const uj = await up.json().catch(() => ({}));
  if (!up.ok || uj.success === false) throw new Error('ig upload: ' + JSON.stringify(uj).slice(0, 300));
  // 인스타 쪽 처리 완료(FINISHED)까지 대기 후 게시 (최대 약 4분)
  for (let i = 0; i < 16; i++) {
    await sleep(15000);
    const sr = await fetch(`${API}/${c.id}?fields=status_code,status&access_token=${TOKEN}`); trackUsage(sr);
    const s = await sr.json().catch(() => ({}));
    if (s.status_code === 'FINISHED') {
      const pub = await graph(`${igId}/media_publish`, { creation_id: c.id });
      return pub.id;
    }
    if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('ig processing: ' + JSON.stringify(s).slice(0, 300));
  }
  throw new Error('ig processing timeout');
}

let failed = 0;
const ledger = loadLedger(slugs);
const FORCE = process.env.FB_FORCE === 'true';
const igId = await findIgUser();
if (!DRY) console.log(igId ? `reels: 인스타그램 연결됨 (${igId})` : 'reels: 인스타그램 미연결 → 페이스북만');
for (const slug of slugs) {
  if (overLimit('reels')) break;
  const needFb = DRY || FORCE || !ledger.reel[slug];
  const needIg = !!igId && (FORCE || !ledger.ig[slug]);
  const needTg = !DRY && telegramReady() && (FORCE || !ledger.tg[slug]);
  // YouTube 무료 한도: 최근 24시간 업로드 수가 YT_DAILY_MAX 미만일 때만
  const ytToday = Object.values(ledger.yt).filter((t) => Date.now() - t < 864e5).length;
  const needYt = !DRY && youtubeReady() && (FORCE || !ledger.yt[slug]) && ytToday < YT_DAILY_MAX;
  if (!needFb && !needIg && !needTg && !needYt) { console.log(`reels: already posted → skip ${slug}`); continue; }
  const p = JSON.parse(fs.readFileSync(path.join('content', 'posts', `${slug}.json`), 'utf8'));
  if (!p.summary?.length) continue;
  let reel;
  try {
    // 태국어 음성 낭독 (실패하면 null → 무음 영상으로 그대로 게시)
    const voice = await narrate(narrationSegments(p), path.join(REEL_DIR, `${slug}-voice`));
    reel = await makeReel(p, CAT_COLOR[p.category], voice);
    fs.rmSync(path.join(REEL_DIR, `${slug}-voice`), { recursive: true, force: true });
    console.log(`reels: rendered ${slug} (${(reel.size / 1e6).toFixed(1)}MB, ${reel.duration.toFixed(1)}s, ${reel.voiced ? '음성' : '무음'})`);
  } catch (e) {
    failed++;
    console.error(`reels: render FAILED ${slug}:`, e.message);
    continue;
  }
  if (DRY) continue;
  const tags = `${p.tags.slice(0, 4).map(hashtag).join(' ')} #ข่าววันนี้`;
  if (needFb) {
    try {
      const r = await publishReel(reel.file, `${p.title}\n\n👉 อ่านต่อ: ${SITE}/post/${slug}/\n\n${tags}`);
      console.log(`reels: facebook posted ${r.video_id} [${r.status}] ← ${slug}`);
      ledger.reel[slug] = Date.now(); saveLedger(ledger);
    } catch (e) { failed++; console.error(`reels: facebook FAILED ${slug}:`, e.message); }
  }
  if (needIg) {
    try {
      // 인스타 캡션의 링크는 클릭이 안 됨 → 프로필 링크 안내 + 주소 텍스트
      const id = await publishIgReel(igId, reel.file, `${p.title}\n\n${p.excerpt}\n\n🔗 อ่านฉบับเต็มที่ลิงก์ในโปรไฟล์ (${SITE.replace(/^https?:\/\//, '')})\n\n${tags}`);
      console.log(`reels: instagram posted ${id} ← ${slug}`);
      ledger.ig[slug] = Date.now(); saveLedger(ledger);
    } catch (e) { failed++; console.error(`reels: instagram FAILED ${slug}:`, e.message); }
  }
  if (needTg) {
    try {
      // TikTok 에 그대로 붙여넣을 캡션 (TikTok 은 해시태그가 노출에 중요)
      const tiktokCaption = `${p.title}

${p.tags.slice(0, 5).map(hashtag).join(' ')} #ข่าววันนี้ #ข่าวบันเทิง #fyp #ฟีดดดシ`;
      await sendTelegramVideo(reel.file, `📱 TikTok용 영상

${tiktokCaption}`);
      console.log(`reels: telegram sent ← ${slug}`);
      ledger.tg[slug] = Date.now(); saveLedger(ledger);
    } catch (e) { failed++; console.error(`reels: telegram FAILED ${slug}:`, e.message); }
  }
  if (needYt) {
    try {
      const id = await uploadShort(reel.file, {
        title: p.title,
        description: `${p.excerpt}

อ่านฉบับเต็มพร้อมแหล่งอ้างอิง: ${SITE}/post/${slug}/

${tags}`,
        tags: p.tags,
      });
      console.log(`reels: youtube uploaded ${id} ← ${slug}`);
      ledger.yt[slug] = Date.now(); saveLedger(ledger);
    } catch (e) { failed++; console.error(`reels: youtube FAILED ${slug}:`, e.message); }
  }
  fs.rmSync(reel.file, { force: true });
}
if (failed) process.exitCode = 1;

// 사용률 기록 (Actions 로그에서 추이 확인용)
console.log(`reels: Meta API 사용률 최고 ${(await import('./lib/meta-usage.mjs')).usagePeak()}%`);
