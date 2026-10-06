// 소셜 채널별로 이미 올린 글 기록 → 재실행/테스트/재시도로 같은 글이 두 번 올라가는 것 방지
// 채널: photo(페북 사진), reel(페북 Reels), ig(인스타 Reels), threads, tg(텔레그램 → TikTok 수동 업로드용), yt(YouTube Shorts)
// .cache 는 Actions 캐시로 실행 간 유지 (실패한 실행에서도 저장)
import fs from 'node:fs';

const FILE = '.cache/fb-posted.json';
export const KINDS = ['photo', 'reel', 'ig', 'threads', 'tg', 'yt'];

// 이미 발행된 글 목록 (이번 실행에서 막 발행된 pending 은 제외)
function existingSlugs(pending) {
  const out = {};
  // 기존 글은 "이틀 전에 게시됨"으로 기록 → 최근 24시간 기준 계산(일일 상한 등)에 섞이지 않음, 90일 정리 대상도 아님
  const now = Date.now() - 2 * 864e5;
  for (const f of fs.readdirSync('content/posts')) {
    const slug = f.replace(/\.json$/, '');
    if (!f.endsWith('.json') || f.startsWith('demo-') || pending.includes(slug)) continue;
    out[slug] = now;
  }
  return out;
}

/**
 * pending: 이번 실행에서 막 발행된 글.
 * 기록이 없거나 새 채널(예: 인스타 연결 직후)이면 기존 글은 "이미 게시됨"으로 채움 → 옛 글이 한꺼번에 올라가지 않음
 */
export function loadLedger(pending = []) {
  let ledger = {};
  if (fs.existsSync(FILE)) {
    try { ledger = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  }
  let changed = false;
  for (const kind of KINDS) {
    if (!ledger[kind]) { ledger[kind] = existingSlugs(pending); changed = true; }
  }
  if (changed) saveLedger(ledger);
  return ledger;
}

export function saveLedger(ledger) {
  fs.mkdirSync('.cache', { recursive: true });
  // 90일 지난 기록은 정리
  for (const kind of KINDS) {
    for (const [k, t] of Object.entries(ledger[kind] || {})) if (Date.now() - t > 90 * 864e5) delete ledger[kind][k];
  }
  // 실패 횟수는 slug 날짜(YYYYMMDD) 기준 7일 지나면 정리
  const cutoff = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  for (const m of Object.values(ledger.tries || {})) for (const slug of Object.keys(m)) if (slug.slice(0, 8) < cutoff) delete m[slug];
  fs.writeFileSync(FILE, JSON.stringify(ledger));
}

// ── 실패한 게시 재시도 ──
// 게시 대상 = 이번 실행 새 글 + 최근 24시간 글 중 kinds 어느 채널에든 아직 안 올라간 글 (실패 3회까지).
// (예전엔 .cache/new-urls.txt 만 봐서, 배포 직후 CDN 지연·일시 오류로 한 번 실패한 글은 그 채널에 영원히 안 올라갔음)
const TRIES_MAX = 3;
const RETRY_PER_RUN = 3; // 한 실행에 재시도는 최대 3건 (밀린 글이 한꺼번에 쏟아지지 않게, 영상은 TTS 한도도 아낌)
const RETRY_WINDOW = 24 * 3.6e6;
export function pendingSlugs(ledger, kinds, newSlugs = [], triesKey = kinds[0]) {
  const tries = ((ledger.tries ||= {})[triesKey] ||= {});
  const out = new Set(newSlugs);
  const recentDay = new Date(Date.now() - 2 * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
  const retry = [];
  for (const f of fs.readdirSync('content/posts').sort().reverse()) { // 최신 글부터
    if (!f.endsWith('.json') || f.startsWith('demo-')) continue;
    const slug = f.slice(0, -5);
    if (out.has(slug) || slug.slice(0, 8) < recentDay || (tries[slug] || 0) >= TRIES_MAX) continue;
    if (kinds.every((k) => ledger[k]?.[slug])) continue;
    let createdAt; try { createdAt = JSON.parse(fs.readFileSync(`content/posts/${f}`, 'utf8')).createdAt; } catch { continue; }
    if (Date.now() - Date.parse(createdAt) < RETRY_WINDOW) retry.push(slug);
  }
  for (const slug of retry.slice(0, RETRY_PER_RUN)) { out.add(slug); console.log(`${triesKey}: retry pending → ${slug}`); }
  if (retry.length > RETRY_PER_RUN) console.log(`${triesKey}: ${retry.length - RETRY_PER_RUN} more pending → next run`);
  return [...out];
}
export function markFail(ledger, triesKey, slug) {
  const m = ((ledger.tries ||= {})[triesKey] ||= {});
  m[slug] = (m[slug] || 0) + 1;
  saveLedger(ledger);
}
// 이번 실행 새 글 목록 (run-pipeline 이 기록). 없으면 빈 배열
export const newSlugs = () => {
  try { return fs.readFileSync('.cache/new-urls.txt', 'utf8').split('\n').filter(Boolean).map((p) => p.split('/').filter(Boolean).pop()); } catch { return []; }
};
