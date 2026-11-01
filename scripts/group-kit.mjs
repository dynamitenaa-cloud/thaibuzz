// 페북 그룹 공유 키트: 하루 1번, 우리 페이지에서 "반응이 좋은 릴스/게시물" N개를 골라 그룹용 태국어 캡션 3종과 함께 텔레그램으로 보냄
//  - 사람은 버튼(FB 게시물 열기) → 공유 → 그룹에 공유 → 캡션 붙여넣기 만 하면 됨. 자동 게시는 아님 (메타가 그룹 게시 API 를 막았고, 같은 글을 여러 그룹에 뿌리면 스팸 제한)
//  - 선택 기준: Graph API 로 최근 72시간 릴스(조회수)·게시물(반응+댓글×3+공유×5) 실적 → 점수 상위. 접근 실패 시 사이트 글 기반(링크 공유)으로 대체
//  - 캡션 3종: A 질문형 / B 한줄평형 / C 투표형. 링크는 본문에 넣지 않음 (그룹에서 노출이 줄고 삭제되기 쉬움)
//  - 기록: .cache/group-kit.json (같은 글을 두 번 추천하지 않음)
// 필요: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, (선택) FB_PAGE_ID/FB_PAGE_TOKEN, GOOGLE_GENERATIVE_AI_API_KEY (LLM 실패 시 규칙 기반 캡션)
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { generateJSON } from './lib/writer.mjs';
import { telegramReady, sendTelegramText } from './lib/delivery.mjs';
import { questionOf } from './lib/social.mjs';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thaibuzz.net').replace(/\/$/, '');
const PAGE_URL = process.env.FACEBOOK_URL || '';
const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
const N = Number(process.env.GROUP_KIT_POSTS || 3);
const WINDOW_H = Number(process.env.GROUP_KIT_WINDOW_H || 72);
const MIN_AGE_H = Number(process.env.GROUP_KIT_MIN_AGE_H || 3); // 올린 직후엔 숫자가 작아 비교가 안 됨
const DRY = process.argv.includes('--dry');
const LEDGER = '.cache/group-kit.json';
const API = 'https://graph.facebook.com/v25.0';

if (!DRY && !telegramReady()) { console.log('group-kit: 텔레그램 설정 없음'); process.exit(0); }

const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const now = Date.now();
const num = (x) => Number(x) || 0;
const readPost = (slug) => { try { return JSON.parse(fs.readFileSync(path.join('content', 'posts', `${slug}.json`), 'utf8')); } catch { return null; } };
// 정치·사건성·도박 주제는 그룹 공유에서 제외 (커뮤니티 분쟁·삭제·계정 제한 위험)
const RISKY = /การเมือง|เลือกตั้ง|รัฐบาล|พรรค|ศาล|คดี|ทนาย|ตำรวจ|จับกุม|ฟ้อง|หมิ่น|ฆาตกรรม|ข่มขืน|อุบัติเหตุ|เสียชีวิต|พนัน|หวย|ลอตเตอรี่/;
const okTopic = (p) => !RISKY.test([p.title, p.keyword, p.excerpt, ...(p.summary || []), ...(p.tags || [])].join(' '));

const get = async (p, params = {}) => {
  const u = new URL(`${API}/${p}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('access_token', TOKEN);
  const j = await (await fetch(u, { signal: AbortSignal.timeout(30000) })).json();
  if (j.error) throw new Error(`${p}: ${j.error.message}`);
  return j;
};
const slugOf = (text) => String(text || '').match(/\/post\/([0-9]{8}-[0-9a-f]{8})\//)?.[1];
const absUrl = (u, fallback) => (u ? (u.startsWith('http') ? u : `https://www.facebook.com${u}`) : fallback);

// 1) 페이지 실적 기반 후보 (릴스 + 사진/링크 게시물)
async function pageCandidates() {
  if (!PAGE_ID || !TOKEN) return [];
  const out = [];
  try {
    const reels = await get(`${PAGE_ID}/video_reels`, { fields: 'id,created_time,description,views,post_views,permalink_url', limit: 40 });
    for (const r of reels.data || []) {
      const slug = slugOf(r.description);
      if (slug) out.push({ slug, kind: 'reel', at: Date.parse(r.created_time), score: Math.max(num(r.views), num(r.post_views)) / 50, stat: `릴스 조회 ${Math.max(num(r.views), num(r.post_views)).toLocaleString()}`, url: absUrl(r.permalink_url, `https://www.facebook.com/reel/${r.id}`) });
    }
  } catch (e) { console.warn('group-kit: 릴스 조회 실패 —', e.message); }
  try {
    const posts = await get(`${PAGE_ID}/posts`, { fields: 'id,created_time,message,permalink_url,reactions.limit(0).summary(true),comments.limit(0).summary(true),shares', limit: 40 });
    for (const x of posts.data || []) {
      const slug = slugOf(x.message);
      if (!slug) continue;
      const re = num(x.reactions?.summary?.total_count), co = num(x.comments?.summary?.total_count), sh = num(x.shares?.count);
      out.push({ slug, kind: 'post', at: Date.parse(x.created_time), score: re + co * 3 + sh * 5, stat: `반응 ${re} · 댓글 ${co} · 공유 ${sh}`, url: absUrl(x.permalink_url, `https://www.facebook.com/${x.id}`) });
    }
  } catch (e) { console.warn('group-kit: 게시물 조회 실패 —', e.message); }
  return out;
}

let cands = (await pageCandidates()).filter((c) => now - c.at < WINDOW_H * 36e5 && now - c.at > MIN_AGE_H * 36e5);
const bySlug = new Map();
for (const c of cands.sort((a, b) => b.score - a.score)) if (!bySlug.has(c.slug)) bySlug.set(c.slug, c); // 같은 글은 점수 높은 쪽 하나만
cands = [...bySlug.values()]
  .map((c) => ({ ...c, p: readPost(c.slug) }))
  .filter((c) => c.p && c.p.format !== 'roundup' && okTopic(c.p) && !ledger[c.slug]);
// K-연예(우리 색인 대상·전문 분야)는 가산점
cands.forEach((c) => { c.rank = c.score * (c.p.origin === 'kr' ? 1.5 : 1); });
cands.sort((a, b) => b.rank - a.rank);
console.log(`group-kit: 페이지 실적 후보 ${cands.length}개`);
cands.slice(0, 8).forEach((c) => console.log(`  ${Math.round(c.rank).toString().padStart(6)}  ${c.kind}  ${c.slug}  ${c.stat}`));

// 2) 대체: 페이지 실적을 못 읽으면 사이트 글(링크 공유) 기반
let picks = [];
const cats = new Set();
for (const c of cands) if (picks.length < N && !cats.has(c.p.category)) { picks.push(c); cats.add(c.p.category); }
for (const c of cands) if (picks.length < N && !picks.includes(c)) picks.push(c);
let fromSite = false;
if (!picks.length) {
  fromSite = true;
  const hasNote = (p) => [...(p.editorNote || '').trim()].length >= 60;
  const posts = fs.readdirSync('content/posts').filter((f) => f.endsWith('.json') && !f.startsWith('demo-'))
    .map((f) => JSON.parse(fs.readFileSync(path.join('content/posts', f), 'utf8')))
    .filter((p) => p.format !== 'roundup' && now - Date.parse(p.createdAt) < 36 * 36e5 && !ledger[p.slug] && okTopic(p));
  const score = (p) => (p.origin === 'kr' ? 3 : 0) + (hasNote(p) ? 2 : 0) + (p.poll ? 0.7 : 0) + Math.log10((p.traffic || 100) + 10);
  picks = posts.sort((a, b) => score(b) - score(a)).slice(0, N).map((p) => ({ slug: p.slug, p, kind: 'site', stat: '사이트 글', url: `${SITE}/post/${p.slug}/` }));
  console.log('group-kit: 페이지 실적 후보 없음 → 사이트 글 기반으로 대체');
}
if (!picks.length) { console.log('group-kit: 추천할 글 없음'); process.exit(0); }

const Schema = z.object({
  a: z.string().describe('แบบ A (คำถาม): 2-3 บรรทัด เปิดด้วยคำถามที่คนอยากตอบในคอมเมนต์ ไม่มีลิงก์ ไม่มีแฮชแท็ก'),
  b: z.string().describe('แบบ B (ความเห็นสั้น ๆ): 2-3 บรรทัด เล่าประเด็นเหมือนเพื่อนเล่าให้เพื่อนฟังในกลุ่ม แล้วชวนแสดงความเห็น ไม่มีลิงก์ ไม่มีแฮชแท็ก'),
  c: z.string().describe('แบบ C (ให้เลือก): 2-4 บรรทัด ตั้งตัวเลือก 2 ข้อให้คอมเมนต์เลือก (เช่น "ทีม A หรือ ทีม B?") ไม่มีลิงก์ ไม่มีแฮชแท็ก'),
});
const system = `คุณเป็นสมาชิกกลุ่ม Facebook ภาษาไทยที่เล่าข่าวให้เพื่อนฟัง ไม่ใช่เพจข่าวที่โปรโมตตัวเอง เขียนภาษาพูดธรรมชาติ ห้ามมีลิงก์ ห้ามแฮชแท็ก ห้ามหลอกคลิก ห้ามมีอักษรเกาหลี ห้ามแต่งข้อเท็จจริงนอกเหนือจากข้อมูลที่ให้ ใช้อีโมจิได้ไม่เกิน 2 ตัวต่อแบบ`;

const ruleBased = (p) => {
  const q = questionOf(p).replace(/\s*👇$/, '');
  const opts = p.poll?.length >= 2 ? p.poll.slice(0, 3).join(' หรือ ') : 'เห็นด้วย หรือ ไม่เห็นด้วย';
  return { a: `${p.hook || p.title}\n${q} 👇`, b: `${p.title}\nใครตามเรื่องนี้อยู่บ้าง? เห็นยังไงกันบ้าง`, c: `${p.hook || p.title}\n${p.question || 'คิดว่ายังไง?'}\n${opts} — คอมเมนต์ได้เลย 👇` };
};

fs.mkdirSync('.cache', { recursive: true });
let sent = 0;
const how = fromSite
  ? '1) 아래 버튼으로 글 열기 2) 캡션 복사 → 그룹에 글 올리기 3) 링크는 첫 댓글에'
  : '1) 아래 "FB 게시물 열기" 버튼 → 우리 페이지 게시물이 열려요\n2) 게시물의 "공유" → "그룹에 공유" → 그룹 선택\n3) 캡션 3종 중 하나를 붙여넣고 올리기 (링크 넣지 않기)\n4) 올린 뒤 첫 댓글에 아래 "첫 댓글" 문구 붙이기';
if (!DRY) await sendTelegramText(`📣 오늘의 페북 그룹 공유 (${picks.length}개)\n\n${how}\n\n✅ 규칙\n• 하루 그룹 3~5곳, 같은 그룹엔 하루 1번\n• 그룹마다 A/B/C 중 다른 캡션 쓰기 (복붙 금지)\n• 올리고 1시간 안에 달린 댓글에 답하기\n• 그룹 규칙이 홍보 금지면 그 그룹은 건너뛰기`);
for (const [i, c] of picks.entries()) {
  const p = c.p;
  let cap;
  try {
    const prompt = `ข่าว: ${p.title}\nสรุป: ${(p.summary || []).slice(0, 3).join(' / ')}\nหมวด: ${p.category}\nคำถามชวนคุย: ${p.question || '-'}\nตัวเลือกโหวต: ${(p.poll || []).join(' / ') || '-'}\n\nเขียนแคปชันสำหรับโพสต์ลงกลุ่ม 3 แบบ (A/B/C) ของข่าวนี้`;
    cap = await generateJSON(prompt, Schema, { system, temperature: 0.9 });
    if (/[가-힣]|https?:\/\//.test(JSON.stringify(cap))) throw new Error('한글/링크 섞임');
  } catch (e) { console.warn(`group-kit: LLM 실패(${String(e.message).slice(0, 80)}) → 규칙 기반 캡션`); cap = ruleBased(p); }
  const tag = p.origin === 'kr' ? '🇰🇷 K-ent' : p.category;
  console.log(`group-kit: ${i + 1}/${picks.length} ${c.slug} [${tag}] ${c.stat} ${p.title.slice(0, 40)}`);
  if (DRY) { console.log(c.url); console.log(JSON.stringify(cap, null, 1)); continue; }
  try {
    await sendTelegramText(`━━━ ${i + 1}/${picks.length} · ${tag} · ${c.stat} ━━━\n${p.title}`, [{ text: fromSite ? '🖼 글 열기' : '📘 FB 게시물 열기 → 공유', url: c.url }]);
    for (const [k, label] of [['a', 'A 질문형'], ['b', 'B 한줄평형'], ['c', 'C 투표형']]) {
      await sendTelegramText(cap[k].trim());
      await sendTelegramText(`↑ ${label} (복사해서 그룹 글에 붙이기)`);
    }
    await sendTelegramText(`💬 첫 댓글 문구 (올린 뒤 복사해서 붙이기):\n${fromSite ? `อ่านฉบับเต็มได้ที่นี่ 👉 ${SITE}/post/${c.slug}/` : `ข่าวบันเทิงเกาหลี-ไทย อัปเดตทุกวันที่เพจ ThaiBuzz 👉 ${PAGE_URL || SITE}`}`);
    ledger[c.slug] = now; sent++;
  } catch (e) { console.error(`group-kit: ${c.slug} 전송 실패 — ${e.message}`); }
}
for (const [k, t] of Object.entries(ledger)) if (now - t > 14 * 864e5) delete ledger[k];
fs.writeFileSync(LEDGER, JSON.stringify(ledger));
console.log(`group-kit: ${sent}개 전송`);
