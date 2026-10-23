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

for (const [name, fn] of [['lottery', lottery], ['gold', gold]]) {
  try { await fn(); } catch (e) { console.warn(`${name}: 실패 (기존 데이터 유지) — ${e.message}`); }
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
console.log(`live-data: ${changed} file(s) changed`);
