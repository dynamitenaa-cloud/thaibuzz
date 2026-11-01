// POST /api/ask {text, slug?, website?}  → D1 저장 + 텔레그램으로 편집자에게 전달 (답장하면 /ask/ 에 게시)
import { init, json, SLUG, voterId, sameOrigin } from './_lib.js';

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'no-db' }, 503);
  if (!sameOrigin(request)) return json({ error: 'origin' }, 403);
  const b = await request.json().catch(() => null);
  if (!b) return json({ error: 'bad-request' }, 400);
  if (b.website) return json({ ok: true }); // 허니팟: 봇이 채우는 숨김 칸 → 조용히 무시
  const text = String(b.text || '').trim().replace(/\s+/g, ' ');
  const len = [...text].length;
  if (len < 10 || len > 400) return json({ error: 'length' }, 400);
  if (/https?:\/\/|www\.|\.(com|net|xyz|ru)\b/i.test(text)) return json({ error: 'links' }, 400);
  const slug = SLUG.test(String(b.slug || '')) ? String(b.slug) : null;
  await init(env.DB);
  const voter = await voterId(request);
  const recent = await env.DB.prepare('SELECT COUNT(*) AS n FROM asks WHERE voter = ? AND at > ?').bind(voter, Date.now() - 3600e3).first();
  if ((recent?.n ?? 0) >= 3) return json({ error: 'rate' }, 429);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  await env.DB.prepare('INSERT INTO asks (id, voter, slug, text, at) VALUES (?, ?, ?, ?, ?)').bind(id, voter, slug, text, Date.now()).run();
  if (env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID) {
    const site = new URL(request.url).origin;
    const msg = `❓ 독자 질문 [Q-${id}]\n\n${text}\n\n${slug ? `📰 ${site}/post/${slug}/\n\n` : ''}💬 이 메시지에 답장하면 사이트 /ask/ 에 "한국인 에디터의 답변"으로 올라갑니다 (한국어로 써도 태국어로 번역돼요, 25자 이상)\n🚫 올리기 싫은 질문은 그냥 무시하세요`;
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: msg, disable_web_page_preview: true }),
    }).catch(() => {});
  }
  return json({ ok: true });
}
