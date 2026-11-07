// 축구 참여 기능(Fan XI / BEST 11 / 경기 예측)을 우리 페북 페이지에 주 3번 자동 게시. 링크 게시물 (Graph API, 무료)
//   월 19시(방콕) Fan XI 투표 · 수 19시 BEST 11 만들기 · 금 18시 주말 경기 예측 (다가오는 72시간 경기 최대 4개)
// 매시간 도는 publish 워크플로 안에서 실행 → "그 요일 + 그 시각 이후 + 이번 주에 아직 안 올림" 일 때만 게시. 기록: .cache/football-engage.json
// 필요: FB_PAGE_ID, FB_PAGE_TOKEN (없으면 건너뜀). `--dry` 는 게시 없이 문구만 출력, `--force` 는 요일·시각 무시
import fs from 'node:fs';
import path from 'node:path';

const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thaibuzz.net').replace(/\/$/, '');
const DRY = process.argv.includes('--dry');
const FORCE = process.argv.includes('--force');
const API = 'https://graph.facebook.com/v25.0';
const LEDGER = '.cache/football-engage.json';
const DIR = path.join('content', 'live', 'football');
const LEAGUES = ['premier-league', 'laliga', 'serie-a', 'bundesliga', 'ucl'];

if (!DRY && (!PAGE_ID || !TOKEN)) { console.log('football-engage: FB_PAGE_ID/FB_PAGE_TOKEN 없음 → 건너뜀'); process.exit(0); }

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
const week = isoWeekKey(bkk);
const read = (f) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch { return null; } };
const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const w = (n) => (Number(week.slice(-2)) + n) % 2; // 주마다 문구 번갈아

// ── 문구 ──
const fanXi = () => {
  const xi = read('xi.json');
  if (!xi || xi.round !== week) { console.log(`football-engage: fan-xi — 이번 주(${week}) 후보 아직 없음 (xi.json: ${xi?.round})`); return null; }
  const m = [
    `⚽ ใครคือตัวจริงยอดเยี่ยมประจำสัปดาห์?\nเลือก 11 นักเตะที่เล่นดีที่สุดจากพรีเมียร์ลีก ลาลีกา กัลโช่ บุนเดส (${xi.label})\nเลือกได้เลย GK 1 · กองหลัง 4 · กองกลาง 3 · กองหน้า 3 แล้วดูว่าแฟนบอลคนอื่นเลือกใครบ้าง 👇`,
    `🔥 สัปดาห์นี้ใครเด่นสุด? มาจัด 11 ตัวจริงประจำสัปดาห์กัน (${xi.label})\nโหวตได้ทั้ง 4 ลีกดัง ผลโหวตของแฟน ๆ อัปเดตให้ดูแบบสด ๆ\nบอกหน่อยว่าใครคือ MVP ของคุณ 👇`,
  ][w(0)];
  return { key: `fx-${week}`, message: m, link: `${SITE}/football/fan-xi/` };
};
const best11 = () => ({
  key: `b11-${week}`,
  message: [
    `⚽ จัดทีม BEST 11 ในฝันของคุณ!\nเลือกแผน 4-3-3 / 4-4-2 / 3-5-2 แล้วเลือกนักเตะจากพรีเมียร์ลีก ลาลีกา กัลโช่ บุนเดส ผสมลีกได้ตามใจ\nเสร็จแล้วได้รูปทีมไปแชร์เลย — ใครจัดแรงสุดมาโชว์ในคอมเมนต์ 👇`,
    `🏆 ถ้าเลือกได้แค่ 11 คน คุณจะเลือกใคร?\nสร้างทีมในฝันของคุณ เลือกแผน เลือกนักเตะ แล้วเซฟเป็นรูปแชร์ให้เพื่อนดู\nคอมเมนต์ทีมของคุณมาได้เลย 👇`,
  ][w(1)],
  link: `${SITE}/football/best11/`,
});
const predict = () => {
  const now = Date.now();
  const ms = LEAGUES.flatMap((l) => (read(`${l}.json`)?.fixtures || []).map((f) => ({ ...f, league: l })))
    .filter((f) => f.status === 'pre' && Date.parse(f.date) > now + 2 * 36e5 && Date.parse(f.date) < now + 72 * 36e5)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  if (ms.length < 2) { console.log(`football-engage: predict — 72시간 안 경기 ${ms.length}개 → 건너뜀`); return null; }
  // 리그가 섞이도록 리그당 최대 2경기
  const per = {}; const pick = [];
  for (const m of ms) { per[m.league] = (per[m.league] || 0) + 1; if (per[m.league] <= 2 && pick.length < 4) pick.push(m); }
  const when = (iso) => new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', hour: '2-digit', minute: '2-digit' });
  const list = pick.map((m) => `• ${m.home} พบ ${m.away} (${when(m.date)} น.)`).join('\n');
  return {
    key: `pm-${bkk.toISOString().slice(0, 10)}`,
    message: `🎯 ทายผลบอลสุดสัปดาห์นี้กัน!\n${list}\n\nเลือก ชนะ / เสมอ / แพ้ แล้วดูว่าแฟนบอลคนอื่นทายยังไง (เล่นสนุก ไม่มีเงินรางวัล)\nนัดไหนมั่นใจสุด คอมเมนต์บอกได้เลย 👇`,
    link: `${SITE}/football/predict/`,
  };
};

// 요일/시각 → 오늘 올릴 것
const SCHEDULE = [{ dow: 1, hour: 19, make: fanXi }, { dow: 3, hour: 19, make: best11 }, { dow: 5, hour: 18, make: predict }];
const todo = FORCE || DRY ? SCHEDULE : SCHEDULE.filter((s) => s.dow === dow && hour >= s.hour && hour < s.hour + 5);
if (!todo.length) { console.log(`football-engage: 지금(방콕 ${dow}요일 ${hour}시)은 게시 시각 아님`); process.exit(0); }

let failed = 0;
for (const s of todo) {
  const post = s.make();
  if (!post) continue;
  if (!FORCE && ledger[post.key]) { console.log(`football-engage: ${post.key} 이미 올림 → 건너뜀`); continue; }
  if (DRY) { console.log(`--- ${post.key}\n${post.message}\n${post.link}\n`); continue; }
  const r = await fetch(`${API}/${PAGE_ID}/feed`, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ message: post.message, link: post.link, access_token: TOKEN }) });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j.id) { console.log(`football-engage: posted ${post.key} → ${j.id}`); ledger[post.key] = Date.now(); }
  else { failed++; console.error(`football-engage: FAILED ${post.key}:`, JSON.stringify(j.error ?? j).slice(0, 300)); }
}
if (!DRY) {
  for (const [k, t] of Object.entries(ledger)) if (Date.now() - t > 60 * 864e5) delete ledger[k];
  fs.mkdirSync('.cache', { recursive: true });
  fs.writeFileSync(LEDGER, JSON.stringify(ledger));
}
if (failed) process.exitCode = 1;
