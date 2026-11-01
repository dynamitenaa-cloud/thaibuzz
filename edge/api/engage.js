// GET  /api/engage?slug=…           → { votes:[n..], reacts:{emoji:n}, mine:{vote,reacts[]} }
// POST /api/engage {slug,type:'vote',opt} | {slug,type:'react',emoji}
import { init, json, SLUG, EMOJIS, voterId, sameOrigin } from './_lib.js';

async function snapshot(db, slug, voter) {
  const [v, r, mv, mr] = await db.batch([
    db.prepare('SELECT opt, COUNT(*) AS n FROM votes WHERE slug = ? GROUP BY opt').bind(slug),
    db.prepare('SELECT emoji, COUNT(*) AS n FROM reacts WHERE slug = ? GROUP BY emoji').bind(slug),
    db.prepare('SELECT opt FROM votes WHERE slug = ? AND voter = ?').bind(slug, voter),
    db.prepare('SELECT emoji FROM reacts WHERE slug = ? AND voter = ?').bind(slug, voter),
  ]);
  const votes = [0, 0, 0];
  for (const x of v.results) if (x.opt >= 0 && x.opt < 3) votes[x.opt] = x.n;
  const reacts = {};
  for (const x of r.results) reacts[x.emoji] = x.n;
  return { votes, reacts, mine: { vote: mv.results[0]?.opt ?? null, reacts: mr.results.map((x) => x.emoji) } };
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return json({ error: 'no-db' }, 503);
  const slug = new URL(request.url).searchParams.get('slug') || '';
  if (!SLUG.test(slug)) return json({ error: 'bad-slug' }, 400);
  await init(env.DB);
  return json(await snapshot(env.DB, slug, await voterId(request)));
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'no-db' }, 503);
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  const b = await request.json().catch(() => null);
  if (!b || !SLUG.test(String(b.slug))) return json({ error: 'bad-request' }, 400);
  await init(env.DB);
  const voter = await voterId(request);
  if (b.type === 'vote') {
    const opt = Number(b.opt);
    if (![0, 1, 2].includes(opt)) return json({ error: 'bad-opt' }, 400);
    await env.DB.prepare('INSERT OR IGNORE INTO votes (slug, voter, opt, at) VALUES (?, ?, ?, ?)').bind(b.slug, voter, opt, Date.now()).run();
  } else if (b.type === 'react') {
    if (!EMOJIS.includes(b.emoji)) return json({ error: 'bad-emoji' }, 400);
    const had = await env.DB.prepare('SELECT 1 FROM reacts WHERE slug = ? AND voter = ? AND emoji = ?').bind(b.slug, voter, b.emoji).first();
    if (had) await env.DB.prepare('DELETE FROM reacts WHERE slug = ? AND voter = ? AND emoji = ?').bind(b.slug, voter, b.emoji).run();
    else {
      // 한 사람이 한 글에 반응 최대 2개 (도배 방지)
      const c = await env.DB.prepare('SELECT COUNT(*) AS n FROM reacts WHERE slug = ? AND voter = ?').bind(b.slug, voter).first();
      if ((c?.n ?? 0) >= 2) return json({ error: 'limit' }, 429);
      await env.DB.prepare('INSERT OR IGNORE INTO reacts (slug, voter, emoji) VALUES (?, ?, ?)').bind(b.slug, voter, b.emoji).run();
    }
  } else return json({ error: 'bad-type' }, 400);
  return json(await snapshot(env.DB, b.slug, voter));
}
