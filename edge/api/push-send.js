// 푸시 발송 (GitHub Actions 의 scripts/football-engage.mjs 가 호출). 헤더 x-push-secret 이 환경변수 PUSH_SECRET 과 같아야 함
//   POST { title, body, url, offset } → 구독자 중 offset 부터 최대 40명에게 "빈 푸시" 전송, { sent, gone, failed, next } 반환 (next 가 null 이면 끝)
// 한 번 호출에 보내는 수를 40 으로 제한: Cloudflare 무료 플랜은 요청당 외부 호출 50회까지. 스크립트가 next 로 반복 호출
// 필요한 환경변수(Pages 시크릿): PUSH_SECRET, VAPID_PRIVATE_JWK (P-256 개인키 JWK). 공개키는 PUBLIC 상수 (클라이언트 코드와 동일해야 함)
import { init, json } from './_lib.js';

const PUBLIC = 'BOYBztoyPlc3HoVpOVf_trImPkpB4eWRf_9jrn-AR5N1tdN4283pR0WP9yxu7MaZdBSHf3jhveYW17vg8z3A-JM';
const BATCH = 40;
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const enc = (o) => b64u(new TextEncoder().encode(JSON.stringify(o)));

async function signer(jwkText) {
  const key = await crypto.subtle.importKey('jwk', JSON.parse(jwkText), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const cache = new Map();
  return async (aud) => {
    if (cache.has(aud)) return cache.get(aud);
    const head = `${enc({ typ: 'JWT', alg: 'ES256' })}.${enc({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: 'mailto:contact@thaibuzz.net' })}`;
    const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, new TextEncoder().encode(head));
    const jwt = `${head}.${b64u(sig)}`;
    cache.set(aud, jwt);
    return jwt;
  };
}
const same = (a, b) => { // 길이가 같은 문자열 상수 시간 비교
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
};

export async function onRequestPost({ request, env }) {
  if (!env.DB || !env.PUSH_SECRET || !env.VAPID_PRIVATE_JWK) return json({ error: 'not-configured' }, 503);
  if (!same(request.headers.get('x-push-secret') || '', env.PUSH_SECRET)) return json({ error: 'forbidden' }, 403);
  const b = await request.json().catch(() => ({}));
  const title = String(b.title || '').slice(0, 80), body = String(b.body || '').slice(0, 140), url = String(b.url || '/football/');
  if (!title || !body || !url.startsWith('/')) return json({ error: 'bad-message' }, 400);
  const offset = Math.max(0, Number(b.offset) || 0);
  await init(env.DB);
  if (offset === 0) await env.DB.prepare('INSERT INTO push_msg (id, title, body, url, at) VALUES (1, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, body=excluded.body, url=excluded.url, at=excluded.at').bind(title, body, url, Date.now()).run();
  const subs = (await env.DB.prepare('SELECT endpoint FROM push_subs ORDER BY at LIMIT ? OFFSET ?').bind(BATCH, offset).all()).results;
  const sign = await signer(env.VAPID_PRIVATE_JWK);
  let sent = 0, failed = 0; const gone = [];
  await Promise.all(subs.map(async ({ endpoint }) => {
    try {
      const jwt = await sign(new URL(endpoint).origin);
      const r = await fetch(endpoint, { method: 'POST', headers: { TTL: '43200', Urgency: 'normal', Authorization: `vapid t=${jwt}, k=${PUBLIC}`, 'Content-Length': '0' } });
      if (r.status === 404 || r.status === 410) gone.push(endpoint); else if (r.ok) sent++; else failed++;
    } catch { failed++; }
  }));
  if (gone.length) await env.DB.batch(gone.map((e) => env.DB.prepare('DELETE FROM push_subs WHERE endpoint = ?').bind(e)));
  // 지워진 만큼 뒤 구독자가 앞으로 당겨지므로 다음 offset 은 "지워지지 않은 수"만큼만 증가
  return json({ sent, gone: gone.length, failed, next: subs.length === BATCH ? offset + subs.length - gone.length : null });
}
