// 소셜 채널별로 이미 올린 글 기록 → 재실행/테스트/재시도로 같은 글이 두 번 올라가는 것 방지
// 채널: photo(페북 사진), reel(페북 Reels), ig(인스타 Reels), threads
// .cache 는 Actions 캐시로 실행 간 유지 (실패한 실행에서도 저장)
import fs from 'node:fs';

const FILE = '.cache/fb-posted.json';
export const KINDS = ['photo', 'reel', 'ig', 'threads'];

// 이미 발행된 글 목록 (이번 실행에서 막 발행된 pending 은 제외)
function existingSlugs(pending) {
  const out = {};
  const now = Date.now();
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
  fs.writeFileSync(FILE, JSON.stringify(ledger));
}
