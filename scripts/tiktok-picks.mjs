// 틱톡용 릴스 추천: 페이스북에서 조회수가 가장 높은 최근 릴스 N개를 골라 텔레그램으로 영상 전송 (사용자가 틱톡에 직접 업로드)
//  - 대상: 최근 TIKTOK_WINDOW_H(기본 48)시간 안에 올린 릴스 중 게시 후 TIKTOK_MIN_AGE_H(기본 6)시간 지난 것 (조회수가 쌓인 뒤 비교)
//  - 영상: 페이스북 Graph API 의 source(원본 mp4)에서 내려받음. 없으면 .cache/reels/<slug>.mp4, 그것도 없으면 건너뜀
//  - 보낸 릴스는 .cache/tiktok-picks.json 에 기록 → 같은 영상을 두 번 추천하지 않음
// 필요: FB_PAGE_ID, FB_PAGE_TOKEN, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
import fs from 'node:fs';
import path from 'node:path';
import { caption } from './lib/social.mjs';
import { telegramReady, sendTelegramVideo, sendTelegramText } from './lib/delivery.mjs';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thaibuzz.net').replace(/\/$/, '');
const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
const N = Number(process.env.TIKTOK_PICKS || 2);
const WINDOW_H = Number(process.env.TIKTOK_WINDOW_H || 48);
const MIN_AGE_H = Number(process.env.TIKTOK_MIN_AGE_H || 6);
const DRY = process.argv.includes('--dry');
const LEDGER = '.cache/tiktok-picks.json';
const API = 'https://graph.facebook.com/v25.0';

if (!PAGE_ID || !TOKEN) { console.log('picks: FB_PAGE_ID/FB_PAGE_TOKEN 없음'); process.exit(0); }
if (!DRY && !telegramReady()) { console.log('picks: 텔레그램 설정 없음'); process.exit(0); }

const get = async (p, params = {}) => {
  const u = new URL(`${API}/${p}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('access_token', TOKEN);
  const j = await (await fetch(u, { signal: AbortSignal.timeout(30000) })).json();
  if (j.error) throw new Error(`${p}: ${j.error.message}`);
  return j;
};
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const save = () => { fs.mkdirSync('.cache', { recursive: true }); fs.writeFileSync(LEDGER, JSON.stringify(ledger)); };
const n = (x) => Number(x) || 0;

const reels = await get(`${PAGE_ID}/video_reels`, { fields: 'id,created_time,description,views,post_views,source', limit: 40 });
const now = Date.now();
const rows = reels.data
  .map((r) => ({ id: r.id, at: Date.parse(r.created_time), views: Math.max(n(r.views), n(r.post_views)), source: r.source || '', slug: String(r.description || '').match(/\/post\/([0-9]{8}-[0-9a-f]{8})\//)?.[1] }))
  .filter((r) => r.slug && now - r.at < WINDOW_H * 36e5 && now - r.at > MIN_AGE_H * 36e5);
console.log(`picks: 최근 ${WINDOW_H}h 릴스 ${rows.length}개 (게시 ${MIN_AGE_H}h 이상)`);
rows.sort((a, b) => b.views - a.views).forEach((r) => console.log(`  ${r.views.toString().padStart(6)} views  ${r.slug}${ledger[r.slug] ? '  (이미 추천)' : ''}`));

// 틱톡 커뮤니티 가이드라인: 복권·도박 관련 영상은 삭제/제재 대상 → 추천에서 제외 (페이스북에는 그대로 올라감)
const GAMBLE = /หวย|สลาก|ลอตเตอรี่|เลขเด็ด|เลขดัง|ออกรางวัล|พนัน|คาสิโน|บาคาร่า|(?<!อาร์เน่อ ?)สล็อต|แทงบอล|lottery|lotto|casino|gambling/i; // สล็อต = 슬롯머신, 단 '아르네 슬롯'(리버풀 감독)은 제외
const isGamble = (slug) => { try { const p = JSON.parse(fs.readFileSync(path.join('content', 'posts', `${slug}.json`), 'utf8')); return GAMBLE.test([p.title, p.keyword, ...(p.tags || [])].join(' ')); } catch { return false; } };
const picks = rows.filter((r) => !ledger[r.slug]).filter((r) => { if (isGamble(r.slug)) { console.log(`  skip (복권/도박 → 틱톡 금지): ${r.slug}`); ledger[r.slug] = now; return false; } return true; }).slice(0, N);
if (!picks.length) { console.log('picks: 새로 추천할 릴스 없음'); process.exit(0); }
fs.mkdirSync('.cache/picks', { recursive: true });
let sent = 0;
for (const [i, r] of picks.entries()) {
  const postFile = path.join('content', 'posts', `${r.slug}.json`);
  const p = fs.existsSync(postFile) ? JSON.parse(fs.readFileSync(postFile, 'utf8')) : null;
  let file = path.join('.cache', 'reels', `${r.slug}.mp4`);
  try {
    if (r.source) {
      const res = await fetch(r.source, { signal: AbortSignal.timeout(120000) });
      if (!res.ok) throw new Error(`source ${res.status}`);
      file = path.join('.cache', 'picks', `${r.slug}.mp4`);
      fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
    } else if (!fs.existsSync(file)) { console.warn(`picks: ${r.slug} 영상 파일 없음 → 건너뜀`); continue; }
    const text = `🎯 틱톡 추천 ${i + 1}/${picks.length} · 페북 조회 ${r.views.toLocaleString()}\n\n${p ? caption(p, 'tiktok') : r.slug}\n\n🆔 ${r.slug}\n💬 이 메시지에 답장하면 편집자 노트로 붙습니다`;
    if (DRY) { console.log(`picks: (dry) ${r.slug} ${Math.round(fs.statSync(file).size / 1e6 * 10) / 10}MB`); continue; }
    await sendTelegramVideo(file, text);
    // X 는 API 유료화(2026) → 사용자가 직접 게시. 같은 영상 + 이 문구를 복사해서 올리면 됨
    if (p) await sendTelegramText('𝕏 X용 문구 (영상 같이 첨부)' + String.fromCharCode(10, 10) + caption(p, 'x', SITE + '/post/' + r.slug + '/'));
    ledger[r.slug] = now; save(); sent++;
    console.log(`picks: sent ${r.slug} (${r.views} views)`);
  } catch (e) { console.error(`picks: ${r.slug} 실패 — ${e.message}`); }
}
// 14일 지난 기록 정리
for (const [k, t] of Object.entries(ledger)) if (now - t > 14 * 864e5) delete ledger[k];
save();
console.log(`picks: ${sent}개 전송`);
