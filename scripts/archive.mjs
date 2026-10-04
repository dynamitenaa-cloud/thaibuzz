// Cloudflare Pages 무료 한도(배포당 20,000 파일)와 저장소 용량을 지키기 위한 단계적 보관
//
//  글 1개 = HTML 1 + 썸네일 3 = 4 파일 (postbuild 가 글마다 RSC 부속 파일을 지움)
//   1단계 full : 최신 LIVE_FULL 개 — 전체 (4 파일)
//   2단계 lite : 그다음 LIVE_LITE 개 — 썸네일 삭제, HTML 만 유지 (1 파일). 검색 노출/백링크 유지
//   3단계 gone : 그보다 오래된 글 — content/archive/ 로 이동, 사이트에서 제외
//
//  기본값 (3000 + 6000): 3000×4 + 6000×1 = 18,000 파일 + 기타 페이지 < 20,000
//  하루 30건 기준 약 300일치를 사이트에 유지. 뉴스/가십은 수명이 짧아 오래된 글 손실은 작음.
import fs from 'node:fs';
import path from 'node:path';

const LIVE_FULL = Number(process.env.LIVE_FULL || 3000);
const LIVE_LITE = Number(process.env.LIVE_LITE || 6000);
const POSTS = path.join('content', 'posts');
const ARCHIVE = path.join('content', 'archive');
const THUMBS = path.join('public', 'thumbs');

const posts = fs.readdirSync(POSTS).filter((f) => f.endsWith('.json'))
  .map((f) => ({ f, p: JSON.parse(fs.readFileSync(path.join(POSTS, f), 'utf8')) }))
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

// 고아 썸네일 정리 (JSON 이 없는 파일)
const live = new Set(posts.filter((_, i) => i < LIVE_FULL).flatMap(({ p }) => [p.thumb, p.thumbSm, p.thumbClean, p.thumbLg]).filter(Boolean).map((u) => path.basename(u)));
let orphans = 0;
// 글이 하나도 없으면(체크아웃 오류 등) 모든 썸네일이 고아로 보이므로 정리하지 않음
if (posts.length && fs.existsSync(THUMBS)) for (const f of fs.readdirSync(THUMBS)) {
  if (f.startsWith('.') || f.startsWith('demo-') && process.env.KEEP_DEMO) continue;
  if (!live.has(f)) { fs.rmSync(path.join(THUMBS, f)); orphans++; }
}
console.log(`archive: total=${posts.length} full≤${LIVE_FULL} → lite+${lite}, gone+${gone}, orphan thumbs removed=${orphans}`);
