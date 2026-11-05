// 축구 참여 기능용 선수 데이터 (ESPN 공개 데이터, 무료)
//  1) content/live/football/rosters.json — 4대 리그(프리미어/라리가/세리에A/분데스) 팀별 선수 명단. 하루 1번만 갱신 (BEST 11 만들기용)
//  2) content/live/football/xi.json — 이번 주 Fan XI 투표 후보. 이번 주 월요일(방콕) 이후 처음 돌 때 "지난주" 경기 기록으로 1번만 만들고 그 주 내내 고정
//     (후보가 중간에 바뀌면 득표가 틀어지므로). 후보 선정 = 포지션별 활약 점수 상위 (골·도움·클린시트·세이브 등)
// 변경이 있으면 GITHUB_OUTPUT 에 changed=1. ESPN 실패 시 기존 파일 유지 (사이트는 있는 데이터로 표시)
import fs from 'node:fs';
import path from 'node:path';

const DIR = path.join('content', 'live', 'football');
const LEAGUES = [['premier-league', 'eng.1'], ['laliga', 'esp.1'], ['serie-a', 'ita.1'], ['bundesliga', 'ger.1']];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36'; // 봇 UA 는 403
const FORCE = process.argv.includes('--force');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const espn = async (u) => {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': UA, accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (r.ok) return r.json();
      if (r.status < 500 && r.status !== 429) throw new Error(`espn ${r.status}`);
    } catch (e) { if (i === 2) throw e; }
    await sleep(1500 * (i + 1));
  }
  throw new Error('espn: retries exhausted');
};
let changed = 0;
const write = (file, data) => {
  const next = JSON.stringify(data);
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === next) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next); changed++; return true;
};

// ESPN 세부 포지션 → GK/DF/MF/FW
export const grp = (abbr = '') => {
  const a = String(abbr).toUpperCase();
  if (a === 'G' || a === 'GK') return 'GK';
  if (/^(CD|LB|RB|LWB|RWB|SW|D|CB)/.test(a)) return 'DF';
  if (/^(F|CF|LF|RF|ST|SS)/.test(a)) return 'FW';
  if (/^(M|DM|CM|AM|LM|RM|LW|RW)/.test(a)) return 'MF';
  return '';
};

// ── 1) 명단 ──
async function rosters() {
  const file = path.join(DIR, 'rosters.json');
  // 파일 mtime 은 Actions 체크아웃 때마다 "지금"이 되므로 파일 안의 updatedAt 으로 판단
  const age = fs.existsSync(file) ? Date.now() - Date.parse(JSON.parse(fs.readFileSync(file, 'utf8')).updatedAt || 0) : Infinity;
  if (!FORCE && age < 20 * 36e5) { console.log('rosters: 20시간 이내 → 건너뜀'); return; }
  const out = { updatedAt: new Date().toISOString(), leagues: {} };
  for (const [slug, code] of LEAGUES) {
    try {
      const t = await espn(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams`);
      const teams = t.sports?.[0]?.leagues?.[0]?.teams?.map((x) => x.team) || [];
      const list = [];
      for (const tm of teams) {
        try {
          const r = await espn(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/teams/${tm.id}/roster`);
          let ath = r.athletes || [];
          if (ath[0]?.items) ath = ath.flatMap((g) => g.items || []); // 일부 응답은 포지션별로 묶여 옴
          const players = ath.map((a) => ({ id: String(a.id), n: a.displayName || a.fullName, p: grp(a.position?.abbreviation), no: a.jersey || '' })).filter((a) => a.n && a.p);
          if (players.length >= 11) list.push({ id: String(tm.id), name: tm.displayName, players });
        } catch (e) { console.warn(`rosters: ${slug}/${tm.displayName} 실패 — ${e.message}`); }
        await sleep(150);
      }
      if (list.length >= 10) out.leagues[slug] = list; else console.warn(`rosters: ${slug} 팀 수 부족(${list.length}) → 제외`);
    } catch (e) { console.warn(`rosters: ${slug} 실패 — ${e.message}`); }
  }
  if (Object.keys(out.leagues).length < 2) { console.warn('rosters: 데이터 부족 → 기존 파일 유지'); return; }
  if (fs.existsSync(file)) { // 일부 리그만 실패했으면 그 리그는 기존 값 유지
    const prev = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [s] of LEAGUES) if (!out.leagues[s] && prev.leagues?.[s]) out.leagues[s] = prev.leagues[s];
  }
  console.log(`rosters: ${Object.entries(out.leagues).map(([s, v]) => `${s} ${v.length}팀`).join(', ')}`);
  write(file, out);
}

// ── 2) 주간 Fan XI 후보 ──
const bkk = (d) => new Date(d.getTime() + 7 * 36e5); // UTC 필드 = 방콕 시각
const pad = (n) => String(n).padStart(2, '0');
function isoWeek(d) { // d: 방콕 기준(UTC 필드) → { key:'2026w45', monday:Date(UTC 자정) }
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = (t.getUTCDay() + 6) % 7; // 월=0
  const monday = new Date(t.getTime() - dow * 864e5);
  const th = new Date(monday.getTime() + 3 * 864e5); // 그 주의 목요일이 속한 해
  const y = th.getUTCFullYear();
  const jan1 = new Date(Date.UTC(y, 0, 1));
  const wk = 1 + Math.floor((th - jan1) / 864e5 / 7);
  return { key: `${y}w${pad(wk)}`, monday };
}
const ymd = (d) => `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
const thDate = (d) => d.toLocaleDateString('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short' });

const SC = { GK: (s, st, win) => (st ? 1 : 0) + (s.goalsConceded === 0 && st ? 3 : 0) + s.saves * 0.7 - s.goalsConceded * 0.8 + (win && st ? 1 : 0), DF: (s, st, win) => (st ? 1 : 0) + (s.goalsConceded === 0 && st ? 2 : 0) + s.goals * 5 + s.assists * 3 + (win && st ? 1 : 0), MF: (s, st, win) => (st ? 0.5 : 0) + s.goals * 5 + s.assists * 3 + s.sot * 0.5 + (win && st ? 1 : 0), FW: (s, st, win) => (st ? 0.5 : 0) + s.goals * 5 + s.assists * 3 + s.sot * 0.7 + (win && st ? 1 : 0) };
const stat = (p, name) => Number((p.stats || []).find((x) => x.name === name)?.value) || 0;

async function weeklyXI() {
  const file = path.join(DIR, 'xi.json');
  const now = bkk(new Date());
  const { key, monday } = isoWeek(now);
  const cur = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  if (!FORCE && cur?.round === key) { console.log(`xi: ${key} 후보 이미 있음 → 고정 유지`); return; }
  const prevMon = new Date(monday.getTime() - 7 * 864e5);
  const days = Array.from({ length: 7 }, (_, i) => ymd(new Date(prevMon.getTime() + i * 864e5)));
  const out = { updatedAt: new Date().toISOString(), round: key, label: `ผลงานสัปดาห์ ${thDate(prevMon)} – ${thDate(new Date(monday.getTime() - 864e5))}`, leagues: {} };
  for (const [slug, code] of LEAGUES) {
    try {
      const evs = (await Promise.all(days.map((d) => espn(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/scoreboard?dates=${d}`).then((j) => j.events || []).catch(() => [])))).flat();
      const done = evs.filter((e) => e.status?.type?.completed || e.status?.type?.state === 'post');
      const agg = new Map();
      for (const ev of done) {
        let sum; try { sum = await espn(`https://site.api.espn.com/apis/site/v2/sports/soccer/${code}/summary?event=${ev.id}`); } catch { continue; }
        const comp = ev.competitions?.[0]?.competitors || [];
        for (const side of sum.rosters || []) {
          const win = comp.find((c) => String(c.team?.id) === String(side.team?.id))?.winner === true;
          for (const pl of side.roster || []) {
            const g = grp(pl.position?.abbreviation || pl.athlete?.position?.abbreviation);
            if (!g) continue;
            const played = stat(pl, 'appearances') > 0;
            if (!played) continue;
            const s = { goals: stat(pl, 'totalGoals'), assists: stat(pl, 'goalAssists'), saves: stat(pl, 'saves'), sot: stat(pl, 'shotsOnTarget'), goalsConceded: stat(pl, 'goalsConceded') };
            const starter = !!pl.starter;
            if ((g === 'GK' || g === 'DF') && !starter && !s.goals && !s.assists) continue; // 수비 후보는 선발이거나 공격 포인트가 있어야
            let sc = SC[g](s, starter, win) - stat(pl, 'redCards') * 3 - stat(pl, 'ownGoals') * 2;
            const id = String(pl.athlete?.id);
            const a = agg.get(id) || { id, name: pl.athlete?.displayName, team: side.team?.displayName, g, score: 0, goals: 0, assists: 0, saves: 0, cs: 0, games: 0 };
            a.score += sc; a.goals += s.goals; a.assists += s.assists; a.saves += s.saves; a.games++;
            if (starter && s.goalsConceded === 0 && (g === 'GK' || g === 'DF')) a.cs++;
            agg.set(id, a);
          }
        }
        await sleep(120);
      }
      const K = { GK: 5, DF: 8, MF: 8, FW: 8 };
      const positions = {};
      for (const g of Object.keys(K)) {
        positions[g] = [...agg.values()].filter((a) => a.g === g).sort((a, b) => b.score - a.score).slice(0, K[g]).map((a) => ({
          id: a.id, name: a.name, team: a.team,
          note: [a.goals && `${a.goals} ประตู`, a.assists && `${a.assists} แอสซิสต์`, a.cs && `คลีนชีต ${a.cs}`, a.saves >= 3 && `เซฟ ${a.saves}`, `ลง ${a.games} นัด`].filter(Boolean).join(' · '),
        }));
      }
      if (done.length >= 3 && positions.GK.length >= 3 && positions.DF.length >= 5 && positions.MF.length >= 5 && positions.FW.length >= 5) out.leagues[slug] = { matches: done.length, positions };
      else console.warn(`xi: ${slug} 지난주 경기 ${done.length}개 / 후보 부족 → 제외`);
      console.log(`xi: ${slug} ${done.length} matches`);
    } catch (e) { console.warn(`xi: ${slug} 실패 — ${e.message}`); }
  }
  if (!Object.keys(out.leagues).length) { console.warn('xi: 후보를 만들 수 없음 → 기존 파일 유지'); return; }
  write(file, out);
  console.log(`xi: ${key} 후보 생성 (${Object.keys(out.leagues).join(', ')})`);
}

for (const [name, fn] of [['rosters', rosters], ['xi', weeklyXI]]) {
  try { await fn(); } catch (e) { console.warn(`${name}: 실패 (기존 데이터 유지) — ${e.message}`); }
}
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
console.log(`football-players: ${changed} file(s) changed`);
