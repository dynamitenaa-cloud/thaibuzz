// 새 글 → Threads 이미지 게시물 (Threads API, 무료)
// 필요: THREADS_TOKEN (60일 장기 토큰). 없으면 조용히 건너뜀
// 토큰 자동 연장: 7일마다 refresh → .cache/threads-token.json 에 보관 (Actions 캐시로 실행 간 유지)
//   ※ 60일 동안 갱신이 끊기면(캐시 유실 + 시크릿 만료) 영구 만료 → 실패 알림 메일 → 토큰 재발급 필요
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadLedger, saveLedger, pendingSlugs, markFail, newSlugs } from './lib/posted.mjs';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const API = 'https://graph.threads.net/v1.0';
const DRY = process.argv.includes('--dry');
const TOKEN_FILE = '.cache/threads-token.json';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.env.THREADS === 'false') { console.log('threads: THREADS=false → 건너뜀'); process.exit(0); }

// 시크릿의 토큰이 바뀌면(재발급) 캐시된 옛 토큰은 버림 → seed 로 구분
const seed = crypto.createHash('sha256').update(process.env.THREADS_TOKEN || '').digest('hex').slice(0, 16);
async function token() {
  let t = process.env.THREADS_TOKEN || '', refreshedAt = 0;
  try {
    const c = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8'));
    if (c.token && c.seed === seed) { t = c.token; refreshedAt = c.refreshedAt || 0; }
    else if (c.token) console.log('threads: 시크릿 토큰이 바뀜 → 캐시된 토큰 무시');
  } catch {}
  if (!t) return '';
  // 발급 후 24시간이 지나야 갱신 가능. 7일마다 갱신하면 60일 만료에 걸릴 일이 없음
  if (Date.now() - refreshedAt > 7 * 864e5) {
    try {
      const r = await (await fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${t}`)).json();
      if (r.access_token) {
        t = r.access_token;
        fs.mkdirSync('.cache', { recursive: true });
        fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token: t, refreshedAt: Date.now(), seed }));
        console.log(`threads: 토큰 갱신됨 (유효 ${Math.round((r.expires_in || 0) / 86400)}일)`);
      } else console.warn('threads: 토큰 갱신 실패', JSON.stringify(r.error ?? r).slice(0, 200));
    } catch (e) { console.warn('threads: 토큰 갱신 오류', e.message); }
  }
  return t;
}

async function post(pathname, params, t) {
  const r = await fetch(`${API}/${pathname}`, { method: 'POST', body: new URLSearchParams({ ...params, access_token: t }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error(JSON.stringify(j.error ?? j).slice(0, 300));
  return j;
}

const hashtag = (s) => '#' + s.replace(/[^\p{L}\p{M}\p{N}]/gu, '');
// Threads 본문은 500자 제한. URL 은 본문에 넣으면 자동으로 링크가 됨
function caption(p, url) {
  const tail = `\n\n👉 ${url}\n${hashtag(p.tags[0] || 'ข่าววันนี้')}`;
  let body = `${p.title}\n\n${p.excerpt}`;
  const max = 500 - [...tail].length;
  if ([...body].length > max) body = [...body].slice(0, max - 1).join('') + '…';
  return body + tail;
}

const fresh = newSlugs();
const ledger = loadLedger(fresh);
const slugs = DRY ? fresh : pendingSlugs(ledger, ['threads'], fresh);
if (!slugs.length) { console.log('threads: 게시할 글 없음'); process.exit(0); }

const t = DRY ? 'dry' : await token();
if (!t) { console.log('threads: THREADS_TOKEN 없음 → 건너뜀'); process.exit(0); }
const me = DRY ? { id: 'dry' } : await (await fetch(`${API}/me?fields=id,username&access_token=${t}`)).json();
if (me.error) { fs.rmSync(TOKEN_FILE, { force: true }); console.error('threads: 토큰 오류 (만료되었으면 재발급 필요)', JSON.stringify(me.error).slice(0, 200)); process.exit(1); }

const FORCE = process.env.FB_FORCE === 'true';
let failed = 0;
for (const slug of slugs) {
  if (!DRY && !FORCE && ledger.threads[slug]) { console.log(`threads: already posted → skip ${slug}`); continue; }
  const p = JSON.parse(fs.readFileSync(path.join('content', 'posts', `${slug}.json`), 'utf8'));
  const url = `${SITE}/post/${slug}/`;
  const text = caption(p, url);
  const image = p.thumb ? `${SITE}${p.thumb}` : '';
  if (DRY) { console.log(`--- ${image ? 'IMAGE' : 'TEXT'} (${[...text].length}자)\n${text}\n`); continue; }
  try {
    const c = await post(`${me.id}/threads`, image ? { media_type: 'IMAGE', image_url: image, text } : { media_type: 'TEXT', text }, t);
    await sleep(image ? 15000 : 3000); // 이미지 처리 대기 (공식 권장: 게시 전 잠시 대기)
    const pub = await post(`${me.id}/threads_publish`, { creation_id: c.id }, t);
    console.log(`threads: posted ${pub.id} ← ${slug}`);
    ledger.threads[slug] = Date.now(); saveLedger(ledger);
  } catch (e) { failed++; markFail(ledger, 'threads', slug); console.error(`threads: FAILED ${slug}:`, e.message); }
  await sleep(3000);
}
if (failed) process.exitCode = 1;
