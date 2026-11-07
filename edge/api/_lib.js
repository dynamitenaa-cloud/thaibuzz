// 참여 기능 공통 (Cloudflare Pages Functions + D1). scripts/postbuild.mjs 가 edge/ → functions/ 로 복사
// D1 바인딩 이름은 DB. 테이블은 첫 호출 때 자동 생성 (별도 마이그레이션 불필요)
const SCHEMA = [
  'CREATE TABLE IF NOT EXISTS votes (slug TEXT NOT NULL, voter TEXT NOT NULL, opt INTEGER NOT NULL, at INTEGER NOT NULL, PRIMARY KEY (slug, voter))',
  'CREATE TABLE IF NOT EXISTS reacts (slug TEXT NOT NULL, voter TEXT NOT NULL, emoji TEXT NOT NULL, PRIMARY KEY (slug, voter, emoji))',
  'CREATE TABLE IF NOT EXISTS asks (id TEXT PRIMARY KEY, voter TEXT NOT NULL, slug TEXT, text TEXT NOT NULL, at INTEGER NOT NULL)',
  'CREATE INDEX IF NOT EXISTS asks_voter ON asks (voter, at)',
  'CREATE TABLE IF NOT EXISTS xi_votes (round TEXT NOT NULL, league TEXT NOT NULL, pos TEXT NOT NULL, cand INTEGER NOT NULL, voter TEXT NOT NULL, PRIMARY KEY (round, league, pos, cand, voter))',
  'CREATE TABLE IF NOT EXISTS push_subs (endpoint TEXT PRIMARY KEY, at INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS push_msg (id INTEGER PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, url TEXT NOT NULL, at INTEGER NOT NULL)',
];
let ready;
export const init = (db) => (ready ??= db.batch(SCHEMA.map((s) => db.prepare(s))).catch((e) => { ready = undefined; throw e; }));

export const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export const SLUG = /^[0-9]{8}-[0-9a-f]{8}(-roundup)?$|^[0-9a-z-]{6,60}$/;
export const EMOJIS = ['😮', '😂', '😢', '😡', '❤️'];

// 같은 사람 식별: IP + UA 해시 (원문 저장 안 함). 한 사람이 한 글에 한 표
export async function voterId(request) {
  const raw = `${request.headers.get('cf-connecting-ip') || ''}|${request.headers.get('user-agent') || ''}|tb1`;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  return [...new Uint8Array(buf)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 다른 사이트에서 몰래 호출하는 것 방지
export function sameOrigin(request) {
  const o = request.headers.get('origin');
  if (!o) return true;
  try { const h = new URL(o).host; const me = new URL(request.url).host; return h === me || h === 'www.' + me || me === 'www.' + h; } catch { return false; }
}
