// Cloudflare Pages 무료 한도(배포당 20,000 파일)와 저장소 용량을 지키기 위한 단계적 보관
//
//  postbuild 가 모든 페이지의 RSC 부속 파일을 지우므로 페이지 1개 = 파일 1개.
//   1단계 full : 최신 LIVE_FULL 개 — HTML 1 + 썸네일 3 = 4 파일
//   2단계 lite : 그다음 LIVE_LITE 개 — 썸네일 삭제, HTML 만 유지 = 1 파일 (검색 노출/백링크 유지)
//   3단계 gone : 그보다 오래된 글 — content/archive/ 로 이동, 사이트에서 제외
//  + 태그 페이지(글 2개 이상인 태그만) 1 파일씩, 기타 페이지 약 100개
//
//  기본값 2500×4 + 4500×1 = 14,500 + 태그 ~2,500 + 기타 ≈ 17,000 (< 20,000, postbuild 안전선 19,000)
//  하루 30건 기준 약 230일치를 사이트에 유지.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const LIVE_FULL = Number(process.env.LIVE_FULL || 2500);
const LIVE_LITE = Number(process.env.LIVE_LITE || 4500);
// 잘못된 값(예: "3k")이면 NaN → 모든 썸네일을 고아로 판단해 지워버리므로 즉시 중단
if (!Number.isInteger(LIVE_FULL) || !Number.isInteger(LIVE_LITE) || LIVE_FULL < 1 || LIVE_LITE < 0) {
  console.error(`archive: 잘못된 설정 LIVE_FULL=${process.env.LIVE_FULL} LIVE_LITE=${process.env.LIVE_LITE} → 아무것도 하지 않음`);
  process.exit(1);
}
const POSTS = path.join('content', 'posts');
const ARCHIVE = path.join('content', 'archive');
const THUMBS = path.join('public', 'thumbs');

const posts = fs.readdirSync(POSTS).filter((f) => f.endsWith('.json') && !f.startsWith('demo-'))
  .flatMap((f) => { try { return [{ f, p: JSON.parse(fs.readFileSync(path.join(POSTS, f), 'utf8')) }]; } catch { console.warn('archive: skip corrupt', f); return []; } })
  .sort((a, b) => b.p.createdAt.localeCompare(a.p.createdAt));

const rmThumbs = (p) => {
  for (const u of [p.thumb, p.thumbSm, p.thumbClean, p.thumbLg]) {
    if (u) fs.rmSync(path.join('public', u), { force: true });
  }
};

let lite = 0, gone = 0;
posts.forEach(({ f, p }, i) => {
  if (i >= LIVE_FULL + LIVE_LITE) {
    rmThumbs(p);
    fs.mkdirSync(ARCHIVE, { recursive: true });
    fs.renameSync(path.join(POSTS, f), path.join(ARCHIVE, f));
    gone++;
  } else if (i >= LIVE_FULL && !p.lite) {
    rmThumbs(p);
    Object.assign(p, { lite: true, thumb: '', thumbSm: '', thumbClean: '', thumbLg: '' });
    fs.writeFileSync(path.join(POSTS, f), JSON.stringify(p, null, 2));
    lite++;
  }
});

// 고아 썸네일 정리 (JSON 이 없는 파일). 글이 하나도 없으면(체크아웃 오류 등) 전부 고아로 보이므로 건너뜀
const live = new Set(posts.filter((_, i) => i < LIVE_FULL).flatMap(({ p }) => [p.thumb, p.thumbSm, p.thumbClean, p.thumbLg]).filter(Boolean).map((u) => path.basename(u)));
let orphans = 0;
if (posts.length && fs.existsSync(THUMBS)) for (const f of fs.readdirSync(THUMBS)) {
  if (f.startsWith('.') || f.startsWith('demo-')) continue;
  if (!live.has(f)) { fs.rmSync(path.join(THUMBS, f)); orphans++; }
}

// 배포 파일 수 추정 (태그 페이지 포함) — 안전선에 가까우면 경고
const kept = posts.slice(0, LIVE_FULL + LIVE_LITE).map(({ p }) => p);
const tagCount = new Map();
for (const p of kept) for (const t of p.tags || []) {
  const k = crypto.createHash('md5').update(t.trim().toLowerCase()).digest('hex').slice(0, 8);
  tagCount.set(k, (tagCount.get(k) || 0) + 1);
}
const tagPages = [...tagCount.values()].filter((n) => n >= 2).length;
const fullN = Math.min(kept.length, LIVE_FULL), liteN = Math.max(0, kept.length - LIVE_FULL);
const est = fullN * 4 + liteN + tagPages + 150;
console.log(`archive: total=${posts.length} → lite+${lite}, gone+${gone}, orphan thumbs=${orphans} | 예상 배포 파일 ${est} (full ${fullN}, lite ${liteN}, 태그 ${tagPages})`);
if (est > 18500) console.warn('archive: ⚠ 파일 수가 한도(20,000)에 가까움 → LIVE_FULL/LIVE_LITE 를 줄이세요');
// 보관 처리로 파일이 바뀌었으면 커밋 단계가 포함하도록
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${lite + gone + orphans > 0 ? 1 : 0}\n`);
