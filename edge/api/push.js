// 웹 푸시 구독 (본문 없는 푸시: 알림이 올 때 서비스 워커가 GET /api/push 로 최신 메시지를 가져와 표시 → 암호화 라이브러리 불필요)
//   POST   { endpoint } → 구독 저장   DELETE { endpoint } → 구독 해지   GET → 최신 알림 { title, body, url }
// 푸시 서비스 주소만 허용 (아무 URL 이나 저장해 서버가 호출하게 되는 것 방지)
import { init, json, sameOrigin } from './_lib.js';

const HOSTS = /^(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|web\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.apple\.com)$/;
function endpointOf(body) {
  const e = String(body?.endpoint || '');
  if (e.length < 20 || e.length > 700) return null;
  try { const u = new URL(e); return u.protocol === 'https:' && HOSTS.test(u.hostname) ? e : null; } catch { return null; }
}
const MAX_SUBS = 50000;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return json({ error: 'no-db' }, 503);
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  const e = endpointOf(await request.json().catch(() => null));
  if (!e) return json({ error: 'bad-endpoint' }, 400);
  await init(env.DB);
  const n = (await env.DB.prepare('SELECT COUNT(*) AS n FROM push_subs').first())?.n || 0;
  if (n >= MAX_SUBS) return json({ error: 'full' }, 429);
  await env.DB.prepare('INSERT INTO push_subs (endpoint, at) VALUES (?, ?) ON CONFLICT(endpoint) DO NOTHING').bind(e, Date.now()).run();
  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  if (!env.DB) return json({ error: 'no-db' }, 503);
  if (!sameOrigin(request)) return json({ error: 'forbidden' }, 403);
  const e = endpointOf(await request.json().catch(() => null));
  if (!e) return json({ error: 'bad-endpoint' }, 400);
  await init(env.DB);
  await env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(e).run();
  return json({ ok: true });
}

export async function onRequestGet({ env }) {
  const fallback = { title: 'ThaiBuzz', body: 'มีอัปเดตใหม่ในเรื่องฟุตบอลและบันเทิง', url: '/football/' };
  if (!env.DB) return json(fallback);
  await init(env.DB);
  const m = await env.DB.prepare('SELECT title, body, url FROM push_msg WHERE id = 1').first();
  return json(m || fallback);
}
