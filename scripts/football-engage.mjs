// 축구 참여 기능(Fan XI / BEST 11 / 경기 예측 / 예측 결과)을 우리 채널에 주 4번 자동 게시: 페북 페이지(링크 게시물) + Threads + X
//   월 12시 지난 주말 예측 결과 · 월 19시 Fan XI 투표 · 수 19시 BEST 11 만들기 · 금 18시 주말 경기 예측 (방콕 시각)
// 매시간 도는 publish 워크플로 안에서 실행 → "그 요일 + 그 시각 이후 5시간 안 + 이번에 아직 안 올린 채널" 일 때만 게시.
// 기록: .cache/football-engage.json (키 = 게시물, 채널별로 따로: key / key:th / key:x). 채널 토큰이 없으면 그 채널만 건너뜀
// 필요(채널별 선택): FB_PAGE_ID+FB_PAGE_TOKEN, THREADS_TOKEN, X_API_KEY/X_API_SECRET/X_ACCESS_TOKEN/X_ACCESS_SECRET
// `--dry` 는 게시 없이 문구만 출력, `--force` 는 요일·시각·기록 무시
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thaibuzz.net').replace(/\/$/, '');
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const LEDGER = '.cache/football-engage.json';
const DIR = path.join('content', 'live', 'football');
const LEAGUES = ['premier-league', 'laliga', 'serie-a', 'bundesliga', 'ucl'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (v) => String(v || '').trim();

const bkk = new Date(Date.now() + 7 * 36e5); // UTC 필드 = 방콕 시각
const dow = bkk.getUTCDay(); // 0=일 … 6=토
const hour = bkk.getUTCHours();
const pad = (n) => String(n).padStart(2, '0');
function isoWeekKey(d) {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const mon = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 864e5);
  const th = new Date(mon.getTime() + 3 * 864e5);
  const y = th.getUTCFullYear();
  return `${y}w${pad(1 + Math.floor((th - new Date(Date.UTC(y, 0, 1))) / 864e5 / 7))}`;
}
let week = isoWeekKey(bkk); // 게시 예정 시각(slot)이 속한 주로 아래에서 다시 설정
let slotDate = bkk.toISOString().slice(0, 10);
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { return null; } };
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const w = (n) => (Number(week.slice(-2)) + n) % 2; // 주마다 문구 번갈아

// ── 게시물 만들기: { key, message(페북·Threads), short(X, 링크 제외 ≈200자 이내), link } ──
const fanXi = () => {
  const xi = read('xi.json');
  if (!xi || xi.round !== week) { console.log(`football-engage: fan-xi — 이번 주(${week}) 후보 아직 없음 (xi.json: ${xi?.round})`); return null; }
  const m = [
    `⚽ ใครคือตัวจริงยอดเยี่ยมประจำสัปดาห์?\nเลือก 11 นักเตะที่เล่นดีที่สุดจากพรีเมียร์ลีก ลาลีกา กัลโช่ บุนเดส (${xi.label})\nเลือกได้เลย GK 1 · กองหลัง 4 · กองกลาง 3 · กองหน้า 3 แล้วดูว่าแฟนบอลคนอื่นเลือกใครบ้าง 👇`,
    `🔥 สัปดาห์นี้ใครเด่นสุด? มาจัด 11 ตัวจริงประจำสัปดาห์กัน (${xi.label})\nโหวตได้ทั้ง 4 ลีกดัง ผลโหวตของแฟน ๆ อัปเดตให้ดูแบบสด ๆ\nบอกหน่อยว่าใครคือ MVP ของคุณ 👇`,
  ][w(0)];
  return { key: `fx-${week}`, message: m, short: '⚽ ใครคือ 11 ตัวจริงยอดเยี่ยมประจำสัปดาห์? โหวตได้เลย GK1 · DF4 · MF3 · FW3 แล้วดูว่าแฟนบอลคนอื่นเลือกใคร 👇', link: `${SITE}/football/fan-xi/`, push: ['🏆 โหวต Fan XI ประจำสัปดาห์', 'มาเลือก 11 ตัวจริงยอดเยี่ยมของสัปดาห์กัน'] };
};
const best11 = () => ({
  key: `b11-${week}`,
  message: [
    `⚽ จัดทีม BEST 11 ในฝันของคุณ!\nเลือกแผน 4-3-3 / 4-4-2 / 3-5-2 แล้วเลือกนักเตะจากพรีเมียร์ลีก ลาลีกา กัลโช่ บุนเดส ผสมลีกได้ตามใจ\nเสร็จแล้วได้รูปทีมไปแชร์เลย — ใครจัดแรงสุดมาโชว์ในคอมเมนต์ 👇`,
    `🏆 ถ้าเลือกได้แค่ 11 คน คุณจะเลือกใคร?\nสร้างทีมในฝันของคุณ เลือกแผน เลือกนักเตะ แล้วเซฟเป็นรูปแชร์ให้เพื่อนดู\nคอมเมนต์ทีมของคุณมาได้เลย 👇`,
  ][w(1)],
  short: '🏆 ถ้าเลือกได้แค่ 11 คน คุณจะเลือกใคร? จัดทีม BEST 11 ในฝันแล้วเซฟเป็นรูปแชร์ได้เลย 👇',
  link: `${SITE}/football/best11/`,
  push: ['⚽ จัดทีม BEST 11 ในฝันของคุณ', 'เลือกแผน เลือกนักเตะ แล้วเซฟเป็นรูปแชร์ได้เลย'],
});
const when = (iso) => new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', hour: '2-digit', minute: '2-digit' });
const predict = () => {
  const now = Date.now();
  const ms = LEAGUES.flatMap((l) => (read(`${l}.json`)?.fixtures || []).map((f) => ({ ...f, league: l })))
    .filter((f) => f.status === 'pre' && Date.parse(f.date) > now + 2 * 36e5 && Date.parse(f.date) < now + 72 * 36e5)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (ms.length < 2) { console.log(`football-engage: predict — 72시간 안 경기 ${ms.length}개 → 건너뜀`); return null; }
  const per = {}; const pick = [];
  for (const m of ms) { per[m.league] = (per[m.league] || 0) + 1; if (per[m.league] <= 2 && pick.length < 4) pick.push(m); }
  const list = pick.map((m) => `• ${m.home} พบ ${m.away} (${when(m.date)} น.)`).join('\n');
  return {
    key: `pm-${slotDate}`,
    message: `🎯 ทายผลบอลสุดสัปดาห์นี้กัน!\n${list}\n\nเลือก ชนะ / เสมอ / แพ้ แล้วดูว่าแฟนบอลคนอื่นทายยังไง (เล่นสนุก ไม่มีเงินรางวัล)\nนัดไหนมั่นใจสุด คอมเมนต์บอกได้เลย 👇`,
    short: `🎯 ทายผลบอลสุดสัปดาห์!\n${pick.slice(0, 2).map((m) => `• ${m.home} พบ ${m.away}`).join('\n')}\nและอีกหลายนัด เลือก ชนะ/เสมอ/แพ้ ดูว่าแฟนบอลคนอื่นทายยังไง (เล่นสนุก ไม่มีรางวัล) 👇`,
    link: `${SITE}/football/predict/`,
    push: ['🎯 ทายผลบอลสุดสัปดาห์นี้', `${pick.length} นัดน่าดู เลือก ชนะ/เสมอ/แพ้ ได้เลย`],
  };
};
// 지난 4일 안에 끝난 경기 중 투표 5표 이상인 경기의 "맞힌 비율". 투표 집계는 공개 API(GET /api/matches)에서 읽음
const recap = async () => {
  const now = Date.now();
  const done = LEAGUES.flatMap((l) => (read(`${l}.json`)?.results || []).map((f) => ({ ...f, league: l })))
    .filter((f) => f.status === 'post' && Date.parse(f.date) > now - 4 * 864e5 && /^[0-9]{5,12}$/.test(f.id)).slice(0, 40);
  if (!done.length) return null;
  let data = {};
  try { const r = await fetch(`${SITE}/api/matches?ids=${done.map((m) => `m${m.id}`).join(',')}`, { signal: AbortSignal.timeout(20000) }); if (r.ok) data = await r.json(); } catch {}
  const rows = done.map((m) => {
    const v = data[`m${m.id}`]?.votes; if (!v) return null;
    const total = v.reduce((a, b) => a + b, 0); if (total < 5) return null;
    const win = Number(m.hs) > Number(m.as) ? 0 : Number(m.hs) < Number(m.as) ? 2 : 1;
    return { m, total, pct: Math.round((v[win] / total) * 100) };
  }).filter(Boolean).sort((a, b) => b.total - a.total).slice(0, 4);
  if (rows.length < 2) { console.log(`football-engage: recap — 투표 5표 이상 경기 ${rows.length}개 → 건너뜀`); return null; }
  const list = rows.map((r) => `• ${r.m.home} ${r.m.hs}-${r.m.as} ${r.m.away} — ทายถูก ${r.pct}% (${r.total.toLocaleString('th-TH')} คน)`).join('\n');
  const best = [...rows].sort((a, b) => b.pct - a.pct)[0], worst = [...rows].sort((a, b) => a.pct - b.pct)[0];
  return {
    key: `rc-${week}`,
    message: `📊 สรุปผลทายผลบอลสุดสัปดาห์ที่ผ่านมา\n${list}\n\nนัดที่ทายง่ายสุด: ${best.m.home} พบ ${best.m.away} (${best.pct}%) · นัดที่หักมุมสุด: ${worst.m.home} พบ ${worst.m.away} (${worst.pct}%)\nคุณทายถูกกี่นัด? มาดูคะแนนของคุณ แล้วทายนัดต่อไปได้เลย 👇`,
    short: `📊 สรุปผลทายผลบอลสุดสัปดาห์\n${rows.slice(0, 2).map((r) => `• ${r.m.home} ${r.m.hs}-${r.m.as} ${r.m.away} ทายถูก ${r.pct}%`).join('\n')}\nคุณทายถูกกี่นัด? 👇`,
    link: `${SITE}/football/predict/`,
    push: ['📊 สรุปผลทายผลบอลสุดสัปดาห์', 'ดูว่าแฟนบอลทายถูกกี่เปอร์เซ็นต์ และคุณทายถูกกี่นัด'],
  };
};

// ── 채널 ──
async function toFacebook(p) {
  if (!process.env.FB_PAGE_ID || !process.env.FB_PAGE_TOKEN) return 'skip';
  const r = await fetch(`https://graph.facebook.com/v25.0/${process.env.FB_PAGE_ID}/feed`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ message: p.message, link: p.link, access_token: process.env.FB_PAGE_TOKEN }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.id) throw new Error(JSON.stringify(j.error ?? j).slice(0, 300));
  return j.id;
}
async function toThreads(p) {
  // threads.mjs 가 7일마다 갱신해 .cache/threads-token.json 에 보관하는 토큰을 우선 사용
  let t = T(process.env.THREADS_TOKEN);
  try { const c = JSON.parse(fs.readFileSync('.cache/threads-token.json', 'utf8')); const seed = crypto.createHash('sha256').update(process.env.THREADS_TOKEN || '').digest('hex').slice(0, 16); if (c.token && c.seed === seed) t = c.token; } catch {}
  if (!t || process.env.THREADS === 'false') return 'skip';
  const api = 'https://graph.threads.net/v1.0';
  const call = async (pth, params) => { const r = await fetch(`${api}/${pth}`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: t }) }); const j = await r.json().catch(() => ({})); if (!r.ok || j.error) throw new Error(JSON.stringify(j.error ?? j).slice(0, 300)); return j; };
  const me = await (await fetch(`${api}/me?fields=id&access_token=${t}`)).json();
  if (!me.id) throw new Error('threads me: ' + JSON.stringify(me.error ?? me).slice(0, 200));
  const text = `${p.message}\n${p.link}`; // 500자 제한
  const c = await call(`${me.id}/threads`, { media_type: 'TEXT', text: [...text].slice(0, 490).join('') });
  await sleep(3000);
  return (await call(`${me.id}/threads_publish`, { creation_id: c.id })).id;
}
const K = { key: T(process.env.X_API_KEY), secret: T(process.env.X_API_SECRET), token: T(process.env.X_ACCESS_TOKEN), tokenSecret: T(process.env.X_ACCESS_SECRET) };
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function xAuth(method, url) {
  const oauth = { oauth_consumer_key: K.key, oauth_nonce: crypto.randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: K.token, oauth_version: '1.0' };
  const base = [method, enc(url), enc(Object.keys(oauth).sort().map((k) => `${enc(k)}=${enc(oauth[k])}`).join('&'))].join('&');
  const sig = crypto.createHmac('sha1', `${enc(K.secret)}&${enc(K.tokenSecret)}`).update(base).digest('base64');
  return 'OAuth ' + Object.entries({ ...oauth, oauth_signature: sig }).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ');
}
async function toX(p) {
  if (!(K.key && K.secret && K.token && K.tokenSecret) || process.env.X === 'false') return 'skip';
  const url = 'https://api.x.com/2/tweets';
  const r = await fetch(url, { method: 'POST', headers: { authorization: xAuth('POST', url), 'content-type': 'application/json' }, body: JSON.stringify({ text: `${p.short}\n${p.link}` }), signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data?.id) throw new Error(`${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j.data.id;
}
async function toPush(p) {
  if (!process.env.PUSH_SECRET || !p.push) return 'skip';
  let offset = 0, sent = 0, gone = 0;
  for (let i = 0; i < 400; i++) { // 구독자 40명씩 (최대 16,000명)
    const r = await fetch(`${SITE}/api/push-send`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-push-secret': process.env.PUSH_SECRET }, body: JSON.stringify({ title: p.push[0], body: p.push[1], url: new URL(p.link).pathname, offset }), signal: AbortSignal.timeout(30000) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`push-send ${r.status} ${JSON.stringify(j).slice(0, 150)}`);
    sent += j.sent; gone += j.gone;
    if (j.next == null) break;
    offset = j.next;
  }
  return `${sent}명 (만료 ${gone})`;
}
const CHANNELS = [['fb', '', toFacebook], ['threads', ':th', toThreads], ['x', ':x', toX], ['push', ':push', toPush]];

// 요일/시각 → 오늘 올릴 것
const SCHEDULE = [{ dow: 1, hour: 12, make: recap }, { dow: 1, hour: 19, make: fanXi }, { dow: 3, hour: 19, make: best11 }, { dow: 5, hour: 18, make: predict }];
// GitHub 정기 실행은 늦거나 건너뛰는 일이 있어서, "가장 최근의 게시 예정 시각(요일+시)" 으로부터 20시간 안이면 올림 (중복은 장부가 막음)
const lastSlot = (d, h) => { for (let i = 0; i < 8; i++) { const t = new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), bkk.getUTCDate() - i, h)); if (t.getUTCDay() === d && t <= bkk) return t; } return null; };
const todo = (FORCE || DRY ? SCHEDULE.map((s) => ({ ...s, at: lastSlot(s.dow, s.hour) || bkk })) : SCHEDULE.map((s) => ({ ...s, at: lastSlot(s.dow, s.hour) })).filter((s) => s.at && bkk - s.at < 20 * 36e5));
if (!todo.length) { console.log(`football-engage: 지금(방콕 ${dow}요일 ${hour}시)은 게시 시각 아님 (예정 시각 후 20시간 안만 게시)`); process.exit(0); }

let failed = 0;
for (const s of todo) {
  week = isoWeekKey(s.at); slotDate = s.at.toISOString().slice(0, 10);
  const post = await s.make();
  if (!post) continue;
  if (DRY) { console.log(`--- ${post.key}\n[FB/Threads]\n${post.message}\n[X] ${[...post.short].length}자 + 링크\n${post.short}\n${post.link}\n`); continue; }
  for (const [name, suffix, send] of CHANNELS) {
    const k = post.key + suffix;
    if (!FORCE && ledger[k]) { console.log(`football-engage: ${k} 이미 올림 → 건너뜀`); continue; }
    try {
      const id = await send(post);
      if (id === 'skip') { console.log(`football-engage: ${name} 설정 없음 → 건너뜀`); continue; }
      console.log(`football-engage: ${name} posted ${post.key} → ${id}`); ledger[k] = Date.now();
    } catch (e) { failed++; console.error(`football-engage: ${name} FAILED ${post.key}: ${e.message}`); }
    await sleep(2000);
  }
}
if (!DRY) {
  for (const [k, t] of Object.entries(ledger)) if (Date.now() - t > 60 * 864e5) delete ledger[k];
  fs.mkdirSync('.cache', { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(ledger));
}
if (failed) process.exitCode = 1;
