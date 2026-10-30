// 새 글 → X(트위터) 게시 (무료 티어: 월 1,500건 쓰기). 태국 K-pop 팬덤의 중심 채널 → K-연예 글 우선
// 필요: X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (OAuth 1.0a, 앱 권한 Read and write). 없으면 조용히 건너뜀
//  - 썸네일을 media/upload(v1.1) 로 올려 이미지 + 글 + 링크. 이미지 업로드 실패 시 글만
//  - 하루 상한 X_DAILY_MAX(기본 12). 기록은 .cache/fb-posted.json 의 x 항목 (다른 채널과 같은 장부)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { loadLedger, saveLedger, pendingSlugs, markFail, newSlugs, underDailyMax, byTraffic, DAILY_MAX } from './lib/posted.mjs';
import { caption } from './lib/social.mjs';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const DRY = process.argv.includes('--dry');
const FORCE = process.env.FB_FORCE === 'true';
const K = { key: process.env.X_API_KEY, secret: process.env.X_API_SECRET, token: process.env.X_ACCESS_TOKEN, tokenSecret: process.env.X_ACCESS_SECRET };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

if (process.env.X === 'false') { console.log('x: X=false → 건너뜀'); process.exit(0); }
if (!DRY && !(K.key && K.secret && K.token && K.tokenSecret)) { console.log('x: 키 없음 → 건너뜀'); process.exit(0); }

// ── OAuth 1.0a (HMAC-SHA1) ──
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
function authHeader(method, url, extraParams = {}) {
  const oauth = {
    oauth_consumer_key: K.key, oauth_nonce: crypto.randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)), oauth_token: K.token, oauth_version: '1.0',
  };
  const all = { ...oauth, ...extraParams };
  const base = [method.toUpperCase(), enc(url), enc(Object.keys(all).sort().map((k) => `${enc(k)}=${enc(all[k])}`).join('&'))].join('&');
  const sig = crypto.createHmac('sha1', `${enc(K.secret)}&${enc(K.tokenSecret)}`).update(base).digest('base64');
  return 'OAuth ' + Object.entries({ ...oauth, oauth_signature: sig }).map(([k, v]) => `${enc(k)}="${enc(v)}"`).join(', ');
}

async function uploadMedia(imageUrl) {
  const img = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
  if (!img.ok) throw new Error(`image ${img.status}`);
  const buf = Buffer.from(await img.arrayBuffer());
  const url = 'https://upload.twitter.com/1.1/media/upload.json';
  const form = new FormData();
  form.append('media_category', 'tweet_image');
  form.append('media', new Blob([buf], { type: 'image/jpeg' }), 'thumb.jpg');
  // multipart 본문은 서명 대상이 아님 (OAuth 파라미터만)
  const r = await fetch(url, { method: 'POST', headers: { authorization: authHeader('POST', url) }, body: form, signal: AbortSignal.timeout(60000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.media_id_string) throw new Error(`media ${r.status} ${JSON.stringify(j).slice(0, 200)}`);
  return j.media_id_string;
}

async function tweet(text, mediaId) {
  const url = 'https://api.x.com/2/tweets';
  const body = mediaId ? { text, media: { media_ids: [mediaId] } } : { text };
  const r = await fetch(url, { method: 'POST', headers: { authorization: authHeader('POST', url), 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.data?.id) throw new Error(`tweet ${r.status} ${JSON.stringify(j).slice(0, 300)}`);
  return j.data.id;
}

const fresh = newSlugs();
const ledger = loadLedger(fresh);
// K-연예 먼저, 그 다음 검색량 순
const pending = DRY ? fresh : pendingSlugs(ledger, ['x'], fresh);
const cat = (s) => { try { return JSON.parse(fs.readFileSync(path.join('content', 'posts', `${s}.json`), 'utf8')).category; } catch { return ''; } };
const slugs = [...byTraffic(pending.filter((s) => cat(s) === 'K-บันเทิง')), ...byTraffic(pending.filter((s) => cat(s) !== 'K-บันเทิง'))];
if (!slugs.length) { console.log('x: 게시할 글 없음'); process.exit(0); }

let failed = 0, posted = 0;
for (const slug of slugs) {
  if (!DRY && !FORCE && ledger.x[slug]) { console.log(`x: already posted → skip ${slug}`); continue; }
  if (!DRY && !FORCE && !underDailyMax(ledger, 'x')) { console.log(`x: 하루 상한 ${DAILY_MAX.x}건 도달 → 나머지는 나중에`); break; }
  const file = path.join('content', 'posts', `${slug}.json`);
  if (!fs.existsSync(file)) continue;
  const p = JSON.parse(fs.readFileSync(file, 'utf8'));
  const url = `${SITE}/post/${slug}/`;
  const text = caption(p, 'x', url);
  const image = p.thumb ? `${SITE}${p.thumb}` : '';
  if (DRY) { console.log(`--- (${[...text].length}자)\n${text}\n`); continue; }
  try {
    let mediaId = '';
    if (image) { try { mediaId = await uploadMedia(image); } catch (e) { console.warn(`x: 이미지 업로드 실패 → 글만 (${e.message.slice(0, 120)})`); } }
    const id = await tweet(text, mediaId);
    console.log(`x: posted ${id}${mediaId ? ' (image)' : ''} ← ${slug}`);
    ledger.x[slug] = Date.now(); saveLedger(ledger); posted++;
  } catch (e) {
    failed++; markFail(ledger, 'x', slug); console.error(`x: FAILED ${slug}:`, e.message);
    if (/\b(401|403)\b/.test(e.message)) { console.error('x: 인증/권한 오류 → 키 4개와 앱 권한(Read and write) 확인'); break; }
    if (/\b429\b/.test(e.message)) { console.error('x: 한도 초과 → 다음 실행에서 재시도'); break; }
  }
  await sleep(2000);
}
console.log(`x: ${posted}개 게시`);
if (failed) process.exitCode = 1;
