// 페북 그룹 공유 키트: 하루 1번, "오늘 올릴 그룹 N곳 + 각 그룹에 맞는 우리 페이지 게시물 + 캡션 + 첫 댓글"을 텔레그램에 보냄
//  - 그룹은 brand/groups.json (가입한 그룹, mode=share 만) 에서 오래 안 올린 순으로 돌려가며 고름. 같은 그룹은 GROUP_MIN_GAP_H(기본 48h) 안에 다시 안 고름
//  - 글은 Graph API 로 최근 72시간 릴스(조회수)·게시물(반응+댓글×3+공유×5) 실적을 보고, 그룹 주제(kdrama/kpop/tpop/news)에 맞는 최고 점수 글을 짝지음
//  - 메시지는 그룹당 1개 (탭하면 복사되는 캡션 + 첫 댓글 + 버튼 2개). 자동 게시 아님 — 사람이 공유 버튼 → 그룹 선택 → 붙여넣기 (메타가 그룹 게시 API 를 막음)
//  - 캡션은 그룹마다 A 질문형 / B 한줄평형 / C 투표형을 돌려 씀. 링크는 본문에 넣지 않음
//  - 기록: .cache/group-kit.json { posts:{slug:{n,at}}, groups:{name:ts}, pairs:{"name|slug":ts} }
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
const GROUPS_PER_DAY = Number(process.env.GROUP_KIT_GROUPS || 3);
const MIN_GAP_H = Number(process.env.GROUP_MIN_GAP_H || 48);
const MAX_SHARES_PER_POST = 3; // 한 글을 서로 다른 그룹에 최대 3번까지만
const WINDOW_H = Number(process.env.GROUP_KIT_WINDOW_H || 72);
const MIN_AGE_H = Number(process.env.GROUP_KIT_MIN_AGE_H || 3); // 올린 직후엔 숫자가 작아 비교가 안 됨
const DRY = process.argv.includes('--dry');
const LEDGER = '.cache/group-kit.json';
const API = 'https://graph.facebook.com/v25.0';

if (!DRY && !telegramReady()) { console.log('group-kit: 텔레그램 설정 없음'); process.exit(0); }

// 예전 형식(slug→시각)이면 posts 로 옮김
const raw = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const ledger = raw.posts || raw.groups || raw.pairs ? { posts: raw.posts || {}, groups: raw.groups || {}, pairs: raw.pairs || {} }
  : { posts: Object.fromEntries(Object.entries(raw).map(([k, t]) => [k, { n: 1, at: t }])), groups: {}, pairs: {} };
const now = Date.now();
const num = (x) => Number(x) || 0;
const readPost = (slug) => { try { return JSON.parse(fs.readFileSync(path.join('content', 'posts', `${slug}.json`), 'utf8')); } catch { return null; } };
// 정치·사건성·도박 주제는 그룹 공유에서 제외 (커뮤니티 분쟁·삭제·계정 제한 위험)
const RISKY = /การเมือง|เลือกตั้ง|รัฐบาล|พรรค|ศาล|คดี|ทนาย|ตำรวจ|จับกุม|ฟ้อง|หมิ่น|ฆาตกรรม|ข่มขืน|อุบัติเหตุ|เสียชีวิต|พนัน|หวย|ลอตเตอรี่/;
const okTopic = (p) => !RISKY.test([p.title, p.keyword, p.excerpt, ...(p.summary || []), ...(p.tags || [])].join(' '));
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 글 → 어떤 주제의 그룹에 맞는지 (맞는 그룹이 없는 글, 예: 스포츠는 오늘 추천에서 빠짐)
function topicsOf(p) {
  const t = new Set();
  const text = [p.title, ...(p.tags || [])].join(' ');
  const kr = p.origin === 'kr' || p.category === 'K-บันเทิง';
  if (kr) { t.add('kpop'); t.add('news'); if (/ซีรีส์|ซีรีย์|ละคร/.test(text)) t.add('kdrama'); }
  else if (p.category === 'ซีรีส์/หนัง') { t.add('kdrama'); t.add('news'); }
  else if (p.category === 'บันเทิง') { t.add('news'); t.add('tpop'); }
  return t;
}

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

const usable = (c) => c.p && c.p.format !== 'roundup' && okTopic(c.p) && (ledger.posts[c.slug]?.n || 0) < MAX_SHARES_PER_POST;
let cands = (await pageCandidates()).filter((c) => now - c.at < WINDOW_H * 36e5 && now - c.at > MIN_AGE_H * 36e5);
const bySlug = new Map();
for (const c of cands.sort((a, b) => b.score - a.score)) if (!bySlug.has(c.slug)) bySlug.set(c.slug, c); // 같은 글은 점수 높은 쪽 하나만
cands = [...bySlug.values()].map((c) => ({ ...c, p: readPost(c.slug) })).filter(usable);
// K-연예(우리 색인 대상·전문 분야)는 가산점
cands.forEach((c) => { c.rank = c.score * (c.p.origin === 'kr' ? 1.5 : 1); });

// 2) 대체: 페이지 실적을 못 읽으면 사이트 글(링크 공유) 기반
let fromSite = false;
if (!cands.length) {
  fromSite = true;
  const hasNote = (p) => [...(p.editorNote || '').trim()].length >= 60;
  const score = (p) => (p.origin === 'kr' ? 3 : 0) + (hasNote(p) ? 2 : 0) + (p.poll ? 0.7 : 0) + Math.log10((p.traffic || 100) + 10);
  cands = fs.readdirSync('content/posts').filter((f) => f.endsWith('.json') && !f.startsWith('demo-'))
    .map((f) => JSON.parse(fs.readFileSync(path.join('content/posts', f), 'utf8')))
    .filter((p) => now - Date.parse(p.createdAt) < 36 * 36e5)
    .map((p) => ({ slug: p.slug, p, kind: 'site', stat: '사이트 글', url: `${SITE}/post/${p.slug}/`, rank: score(p) }))
    .filter(usable);
  console.log('group-kit: 페이지 실적 후보 없음 → 사이트 글 기반으로 대체');
}
cands.sort((a, b) => b.rank - a.rank);
console.log(`group-kit: 후보 ${cands.length}개`);
cands.slice(0, 8).forEach((c) => console.log(`  ${Math.round(c.rank).toString().padStart(6)}  ${c.kind}  ${c.slug}  ${c.stat}  [${[...topicsOf(c.p)].join(',')}]`));

// 3) 오늘 올릴 그룹 고르기: share 모드, 마지막 게시가 오래된 순 (같은 날/48h 안은 제외)
const cfg = JSON.parse(fs.readFileSync(path.join('brand', 'groups.json'), 'utf8')).groups || [];
const share = cfg.filter((g) => g.mode === 'share');
const commentOnly = cfg.filter((g) => g.mode === 'comment-only');
const eligible = share.filter((g) => !ledger.groups[g.name] || now - ledger.groups[g.name] > MIN_GAP_H * 36e5)
  .sort((a, b) => (ledger.groups[a.name] || 0) - (ledger.groups[b.name] || 0) || b.members - a.members);

// 4) 그룹 ↔ 글 짝짓기: 그룹 주제에 맞는 최고 점수 글. 오늘 이미 다른 그룹에 쓴 글은 뒤로 (다양하게), 같은 그룹에 같은 글은 안 줌
const todayUse = new Map();
const plan = [];
for (const g of eligible) {
  if (plan.length >= GROUPS_PER_DAY) break;
  const fit = cands.filter((c) => !ledger.pairs[`${g.name}|${c.slug}`] && [...topicsOf(c.p)].some((t) => g.topics.includes(t)));
  fit.sort((a, b) => (todayUse.get(a.slug) || 0) - (todayUse.get(b.slug) || 0) || b.rank - a.rank);
  const c = fit.find((x) => (ledger.posts[x.slug]?.n || 0) + (todayUse.get(x.slug) || 0) < MAX_SHARES_PER_POST);
  if (!c) { console.log(`group-kit: ${g.name} — 맞는 글 없음 → 건너뜀`); continue; }
  todayUse.set(c.slug, (todayUse.get(c.slug) || 0) + 1);
  plan.push({ g, c, variant: 'abc'[plan.length % 3] });
}
if (!plan.length) { console.log('group-kit: 오늘 짝지을 그룹/글 없음'); process.exit(0); }

const Schema = z.object({
  ko: z.string().describe('이 뉴스가 무슨 내용인지 한국어로 한 줄(40자 이내) 요약. 한국인 에디터가 어떤 글인지 알아보기 위한 용도'),
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
const capCache = new Map();
async function captionsFor(p) {
  if (capCache.has(p.slug)) return capCache.get(p.slug);
  let cap;
  try {
    const prompt = `ข่าว: ${p.title}\nสรุป: ${(p.summary || []).slice(0, 3).join(' / ')}\nหมวด: ${p.category}\nคำถามชวนคุย: ${p.question || '-'}\nตัวเลือกโหวต: ${(p.poll || []).join(' / ') || '-'}\n\nเขียนแคปชันสำหรับโพสต์ลงกลุ่ม 3 แบบ (A/B/C) ของข่าวนี้`;
    cap = await generateJSON(prompt, Schema, { system, temperature: 0.9 });
    if (/[가-힣]|https?:\/\//.test(JSON.stringify({ a: cap.a, b: cap.b, c: cap.c }))) throw new Error('한글/링크 섞임');
  } catch (e) { console.warn(`group-kit: LLM 실패(${String(e.message).slice(0, 80)}) → 규칙 기반 캡션`); cap = ruleBased(p); }
  capCache.set(p.slug, cap);
  return cap;
}

fs.mkdirSync('.cache', { recursive: true });
const groupLink = (g) => g.url || `https://www.facebook.com/search/groups/?q=${encodeURIComponent(g.name)}`;
const VARIANT = { a: '질문형', b: '한줄평형', c: '투표형' };
const how = fromSite ? '글 열기 → 캡션 복사 → 그룹에 글 올리기 → 첫 댓글에 링크' : '캡션 탭(복사) → 📘 게시물 열기 → 공유 → 그룹에 공유 → 붙여넣기 → 올린 뒤 첫 댓글';
let sent = 0;
if (!DRY) await sendTelegramText(`📣 오늘 공유할 그룹 ${plan.length}곳\n${how}\n• 그룹마다 하루 1번 · 올린 뒤 1시간 안에 댓글 답하기${commentOnly.length ? `\n• 댓글만 달 그룹: ${commentOnly.map((g) => g.name).join(', ')}` : ''}`);
for (const [i, { g, c, variant }] of plan.entries()) {
  const p = c.p;
  const cap = await captionsFor(p);
  const first = fromSite ? `อ่านฉบับเต็มได้ที่นี่ 👉 ${SITE}/post/${c.slug}/` : `ข่าวบันเทิงเกาหลี-ไทย อัปเดตทุกวันที่เพจ ThaiBuzz 👉 ${PAGE_URL || SITE}`;
  const tag = p.origin === 'kr' ? '🇰🇷' : p.category;
  console.log(`group-kit: ${i + 1}/${plan.length} [${g.name}] ← ${c.slug} (${VARIANT[variant]}) ${c.stat} ${p.title.slice(0, 40)}`);
  const text = `📍 ${i + 1}/${plan.length} · <b>${esc(g.name)}</b>${g.ko ? ` — ${esc(g.ko)}` : ''} (${Math.round(g.members / 1000)}K)\n${esc(tag)} ${esc(cap.ko || p.title.slice(0, 70))} · ${esc(c.stat)}\n\n캡션 (${VARIANT[variant]}) — 탭하면 복사:\n<pre>${esc(cap[variant].trim())}</pre>\n첫 댓글 — 탭하면 복사:\n<pre>${esc(first)}</pre>`;
  if (DRY) { console.log(c.url, '\n' + cap[variant].trim() + '\n---'); continue; }
  try {
    await sendTelegramText(text, [{ text: fromSite ? '🖼 글 열기' : '📘 게시물 열기 → 공유', url: c.url }, { text: '👥 그룹 열기', url: groupLink(g) }], 'HTML');
    ledger.groups[g.name] = now; ledger.pairs[`${g.name}|${c.slug}`] = now;
    ledger.posts[c.slug] = { n: (ledger.posts[c.slug]?.n || 0) + 1, at: now };
    sent++;
  } catch (e) { console.error(`group-kit: ${g.name} 전송 실패 — ${e.message}`); }
}
// 정리: 글 기록 14일, 그룹 기록 30일, 짝 기록 30일
for (const [k, v] of Object.entries(ledger.posts)) if (now - v.at > 14 * 864e5) delete ledger.posts[k];
for (const [k, t] of Object.entries(ledger.groups)) if (now - t > 30 * 864e5) delete ledger.groups[k];
for (const [k, t] of Object.entries(ledger.pairs)) if (now - t > 30 * 864e5) delete ledger.pairs[k];
fs.writeFileSync(LEDGER, JSON.stringify(ledger));
console.log(`group-kit: ${sent}개 그룹 전송`);
