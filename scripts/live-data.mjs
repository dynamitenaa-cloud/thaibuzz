// 반복 정보 허브용 데이터 수집 (무료 공개 출처). 매시간 파이프라인에서 실행 → content/live/ 에 저장 → 빌드 시 /lottery/, /gold/ 페이지로
//  - 복권: 정부복권사무소(GLO) 공식 API, 최신 회차. 회차별 파일로 누적 (content/live/lottery/<YYYY-MM-DD>.json)
//  - 금값: 사단법인 금거래상협회(สมาคมค้าทองคำ) 고시가를 중계하는 공개 API. 날짜별 1줄로 누적 (content/live/gold.json)
// 어떤 출처가 실패해도 워크플로는 실패하지 않음 (기존 데이터로 페이지 유지)
import fs from 'node:fs';
import path from 'node:path';

const LIVE = path.join('content', 'live');
const LOTTERY = path.join(LIVE, 'lottery');
const GOLD = path.join(LIVE, 'gold.json');
fs.mkdirSync(LOTTERY, { recursive: true });

const UA = 'Mozilla/5.0 (compatible; ThaiBuzzBot/1.0; +https://thaibuzz.net/about/)';
let changed = 0;
const writeIfChanged = (file, obj) => {
  const next = JSON.stringify(obj, null, 2);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) return false;
  fs.writeFileSync(file, next);
  changed++;
  return true;
};

async function lottery() {
  const r = await fetch('https://www.glo.or.th/api/lottery/getLatestLottery', {
    method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: '{}', signal: AbortSignal.timeout(20000),
  });
  if (!r.ok) throw new Error(`GLO ${r.status}`);
  const j = await r.json();
  const d = j?.response;
  if (!d?.date || !d?.data?.first?.number?.[0]?.value) throw new Error('GLO: unexpected shape');
  const tiers = ['first', 'near1', 'second', 'third', 'fourth', 'fifth', 'last3f', 'last3b', 'last2'];
  const out = {
    date: d.date,
    period: d.period,
    pdf: d.pdf_url || '',
    youtube: d.youtube_url || '',
    fetchedAt: new Date().toISOString(),
    prizes: Object.fromEntries(tiers.filter((t) => d.data[t]).map((t) => [t, { price: Number(d.data[t].price), numbers: d.data[t].number.map((n) => String(n.value)).sort() }])),
  };
  const file = path.join(LOTTERY, `${d.date}.json`);
  // 같은 회차는 fetchedAt 만 다르므로 비교 시 제외
  const same = fs.existsSync(file) && JSON.stringify({ ...JSON.parse(fs.readFileSync(file, 'utf8')), fetchedAt: 0 }) === JSON.stringify({ ...out, fetchedAt: 0 });
  if (!same) { fs.writeFileSync(file, JSON.stringify(out, null, 2)); changed++; console.log(`lottery: new draw ${d.date} (1st prize ${out.prizes.first.numbers[0]})`); }
  else console.log(`lottery: draw ${d.date} unchanged`);
}

const num = (s) => Number(String(s).replace(/[^\d.]/g, ''));
async function gold() {
  const r = await fetch('https://api.chnwt.dev/thai-gold-api/latest', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`gold ${r.status}`);
  const j = await r.json();
  const p = j?.response?.price;
  if (!p?.gold_bar?.sell) throw new Error('gold: unexpected shape');
  // update_date "23/10/2569" (불력) → 2026-10-23
  const m = String(j.response.update_date).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const date = m ? `${+m[3] - 543}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
  const time = String(j.response.update_time || '').match(/(\d{1,2}[:.]\d{2})/)?.[1]?.replace('.', ':') || '';
  const round = Number(String(j.response.update_time || '').match(/ครั้งที่\s*(\d+)/)?.[1] || 0);
  const row = { date, time, round, bar: { buy: num(p.gold_bar.buy), sell: num(p.gold_bar.sell) }, orn: { buy: num(p.gold.buy), sell: num(p.gold.sell) } };
  if (!(row.bar.sell > 1000)) throw new Error('gold: implausible price');
  const cur = fs.existsSync(GOLD) ? JSON.parse(fs.readFileSync(GOLD, 'utf8')) : { items: [] };
  const items = cur.items.filter((x) => x.date !== date).concat(row).sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
  if (writeIfChanged(GOLD, { source: 'สมาคมค้าทองคำ', updatedAt: new Date().toISOString(), items })) console.log(`gold: ${date} ${time} bar sell ${row.bar.sell}`);
  else console.log('gold: unchanged');
}

// ── 축구: ESPN 공개 데이터 (순위표 + 최근 4일 결과 + 앞으로 7일 일정). 리그마다 content/live/football/<slug>.json ──
const FOOTBALL = [['premier-league', 'eng.1'], ['laliga', 'esp.1'], ['serie-a', 'ita.1'], ['bundesliga', 'ger.1'], ['ucl', 'uefa.champions']];
const FB_DIR = path.join(LIVE, 'football');
const ESPN_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'; // 봇 UA 는 403
const espn = async (u) => { const r = await fetch(u, { headers: { 'user-agent': ESPN_UA, accept: 'application/json' }, signal: AbortSignal.timeout(20000) }); if (!r.ok) throw new Error(`espn ${r.status}`); return r.json(); };
const ymd = (d) => d.toISOString().slice(0, 10).replace(/-/g, '');
async function football() {
  fs.mkdirSync(FB_DIR, { recursive: true });
  const days = Array.from({ length: 15 }, (_, i) => ymd(new Date(Date.now() + (i - 7) * 864e5))); // -7 ~ +7일
  for (const [slug, code] of FOOTBALL) {
    try {
      const st = await espn(`https://site.api.espn.com/apis/v2/sports/soccer/${code}/standings`);
      const g = st.children?.[0];
      if (!g) throw new Error('no standings');
      const v = (e, n) => Number(e.stats.find((s) => s.name === n)?.value ?? 0);
      const table = g.standings.entries.map((e) => ({ rank: v(e, 'rank'), team: e.team.displayName, p: v(e, 'gamesPlayed'), w: v(e, 'wins'), d: v(e, 'ties'), l: v(e, 'losses'), gf: v(e, 'pointsFor'), ga: v(e, 'pointsAgainst'), gd: v(e, 'pointDifferential'), pts: v(e, 'points') })).sort((a, b) => a.rank - b.rank);
      const evs = (await Promise.all(days.map((d) => espn(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${d}`).then((j) => j.events || []).catch(() => [])))).flat();
      const seen = new Set();
      const matches = evs.filter((e) => !seen.has(e.id) && seen.add(e.id)).map((e) => {
        const c = e.competitions[0];
        const side = (h) => c.competitors.find((x) => x.homeAway === h) || {};
        return { id: e.id, date: e.date, status: c.status.type.state, detail: c.status.type.shortDetail, home: side('home').team?.displayName || '', away: side('away').team?.displayName || '', hs: String(side('home').score ?? ''), as: String(side('away').score ?? ''), venue: c.venue?.fullName || '' };
      }).sort((a, b) => a.date.localeCompare(b.date));
      const rec = { slug, season: g.name || st.name || '', table, results: matches.filter((m) => m.status === 'post'), fixtures: matches.filter((m) => m.status !== 'post') };
      const file = path.join(FB_DIR, `${slug}.json`);
      const prev = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
      const same = prev && JSON.stringify({ ...prev, updatedAt: 0 }) === JSON.stringify({ ...rec, updatedAt: 0 });
      if (!same) { fs.writeFileSync(file, JSON.stringify({ ...rec, updatedAt: new Date().toISOString() }, null, 1)); changed++; }
      console.log(`football: ${slug} ${table.length} teams, ${rec.results.length} results, ${rec.fixtures.length} fixtures${same ? ' (unchanged)' : ''}`);
    } catch (e) { console.warn(`football: ${slug} 실패 (기존 데이터 유지) — ${e.message}`); }
  }
}

for (const [name, fn] of [['lottery', lottery], ['gold', gold], ['football', football]]) {
  try { await fn(); } catch (e) { console.warn(`${name}: 실패 (기존 데이터 유지) — ${e.message}`); }
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
console.log(`live-data: ${changed} file(s) changed`);
