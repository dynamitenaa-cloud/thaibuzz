// 페이스북에 이미 올린 글 기록 → 재실행/테스트 실행/재시도로 같은 글이 두 번 올라가는 것 방지
// .cache 는 Actions 캐시로 실행 간 유지 (실패한 실행에서도 저장)
import fs from 'node:fs';

const FILE = '.cache/fb-posted.json';

// pending: 이번 실행에서 막 발행된 글 → 처음 기록을 만들 때 "이미 게시됨"으로 넣지 않음
export function loadLedger(pending = []) {
  if (fs.existsSync(FILE)) {
    try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch {}
  }
  // 기록 파일이 처음 생길 때: 지금까지 발행된 글은 이미 게시된 것으로 간주 (예전 글이 한꺼번에 올라가지 않도록)
  const now = Date.now();
  const seed = {};
  for (const f of fs.readdirSync('content/posts')) {
    const slug = f.replace(/\.json$/, '');
    if (!f.endsWith('.json') || f.startsWith('demo-') || pending.includes(slug)) continue;
    seed[slug] = now;
  }
  const ledger = { photo: { ...seed }, reel: { ...seed } };
  saveLedger(ledger);
  return ledger;
}

export function saveLedger(ledger) {
  fs.mkdirSync('.cache', { recursive: true });
  // 90일 지난 기록은 정리
  for (const kind of ['photo', 'reel']) {
    for (const [k, t] of Object.entries(ledger[kind] || {})) if (Date.now() - t > 90 * 864e5) delete ledger[kind][k];
  }
  fs.writeFileSync(FILE, JSON.stringify(ledger));
}
