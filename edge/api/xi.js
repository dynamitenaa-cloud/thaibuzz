// Fan XI 투표 (4-3-3: GK1 DF4 MF3 FW3). 한 사람이 포지션별 정해진 인원까지 후보를 고르고(다시 누르면 취소), 득표는 후보 번호(cand)별로 셈
// GET  /api/xi?round=2026w45&league=premier-league → { counts:{gk:{0:n,...},df:{...},...}, mine:{gk:[0],...}, voters:n }
// POST /api/xi {round, league, pos:'gk'|'df'|'mf'|'fw', cand:0..9, on:true|false}
import { init, json, voterId, sameOrigin } from './_lib.js';

const LEAGUES = new Set(['premier-league', 'laliga', 'serie-a', 'bundesliga']);
const MAX = { gk: 1, df: 4, mf: 3, fw: 3 };
const ROUND = /^[0-9]{4}w[0-9]{2}$/;

async function snapshot(db, round, league, voter) {
  const [c, m, n] = await db.batch([
    db.prepare('SELECT pos, cand, COUNT(*) AS n FROM xi_votes WHERE round = ? AND league = ? GROUP BY pos, cand').bind(round, league),
    db.prepare('SELECT pos, cand FROM xi_votes WHERE round = ? AND league = ? AND voter = ?').bind(round, league, voter),
    db.prepare('SELECT COUNT(DISTINCT voter) AS n FROM xi_votes WHERE round = ? AND league = ?').bind(round, league),
  ]);
  const counts = { gk: {}, df: {}, mf: {}, fw: {} };
  for (const x of c.results) if (counts[x.pos]) counts[x.pos][x.cand] = x.n;
  const mine = { gk: [], df: [], mf: [], fw: [] };
  for (const x of m.results) if (mine[x.pos]) mine[x.pos].push(x.cand);
  return { counts, mine, voters: n.results[0]?.n ?? 0 };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'no-db' }, 503);
  const u = new URL(request.url);
  const round = u.searchParams.get('round') || '', league = u.searchParams.get('league') || '';
  if (!ROUND.test(round) || !LEAGUES.has(league)) return json({ error: 'bad-request' }, 400);
  await init(env.DB);
  return json(await snapshot(env.DB, round, league, await voterId(request)));
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'no-db' }, 503);
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  const b = await request.json().catch(() => null);
  const cand = Number(b?.cand);
  if (!b || !ROUND.test(String(b.round)) || !LEAGUES.has(b.league) || !(b.pos in MAX) || !Number.isInteger(cand) || cand < 0 || cand > 11) return json({ error: 'bad-request' }, 400);
  await init(env.DB);
  const voter = await voterId(request);
  if (b.on) {
    const had = await env.DB.prepare('SELECT 1 FROM xi_votes WHERE round = ? AND league = ? AND pos = ? AND cand = ? AND voter = ?').bind(b.round, b.league, b.pos, cand, voter).first();
    if (!had) {
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM xi_votes WHERE round = ? AND league = ? AND pos = ? AND voter = ?').bind(b.round, b.league, b.pos, voter).first();
      if ((c?.n ?? 0) >= MAX[b.pos]) return json({ error: 'limit', max: MAX[b.pos] }, 429);
      await env.DB.prepare('INSERT OR IGNORE INTO xi_votes (round, league, pos, cand, voter) VALUES (?, ?, ?, ?, ?)').bind(b.round, b.league, b.pos, cand, voter).run();
    }
  } else {
    await env.DB.prepare('DELETE FROM xi_votes WHERE round = ? AND league = ? AND pos = ? AND cand = ? AND voter = ?').bind(b.round, b.league, b.pos, cand, voter).run();
  }
  return json(await snapshot(env.DB, b.round, b.league, voter));
}
