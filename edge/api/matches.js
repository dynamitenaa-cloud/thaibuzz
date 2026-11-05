// GET /api/matches?ids=m401879242,m401879243 → { m401879242: { votes:[홈승,무,원정승], mine: 0|1|2|null }, ... }
// 경기 예측은 기존 votes 테이블을 그대로 씀 (slug = "m<ESPN 경기 ID>", opt 0=홈승 1=무승부 2=원정승). 투표 자체는 POST /api/engage
import { init, json, SLUG, voterId } from './_lib.js';

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'no-db' }, 503);
  const ids = [...new Set((new URL(request.url).searchParams.get('ids') || '').split(',').filter(Boolean))].slice(0, 40);
  if (!ids.length || !ids.every((s) => /^m[0-9]{5,12}$/.test(s) && SLUG.test(s))) return json({ error: 'bad-ids' }, 400);
  await init(env.DB);
  const voter = await voterId(request);
  const q = ids.map(() => '?').join(',');
  const [v, m] = await env.DB.batch([
    env.DB.prepare(`SELECT slug, opt, COUNT(*) AS n FROM votes WHERE slug IN (${q}) GROUP BY slug, opt`).bind(...ids),
    env.DB.prepare(`SELECT slug, opt FROM votes WHERE voter = ? AND slug IN (${q})`).bind(voter, ...ids),
  ]);
  const out = Object.fromEntries(ids.map((s) => [s, { votes: [0, 0, 0], mine: null }]));
  for (const x of v.results) if (out[x.slug] && x.opt >= 0 && x.opt < 3) out[x.slug].votes[x.opt] = x.n;
  for (const x of m.results) if (out[x.slug]) out[x.slug].mine = x.opt;
  return json(out);
}
