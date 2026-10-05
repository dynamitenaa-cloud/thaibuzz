// 정적 export 후처리 (npm run build 직후 자동 실행)
//
// 1) RSC 부속 파일 제거: 사이트의 모든 내부 링크는 일반 <a>(전체 페이지 로드)라서 클라이언트 라우터가
//    쓰는 index.txt / __next.* 파일이 필요 없다. 페이지마다 7개 → 1개(index.html)로 줄어
//    Cloudflare Pages 무료 한도(배포당 20,000 파일)를 지킨다. 전체 로드는 AdSense/GA 페이지뷰 집계에도 정확.
// 2) 파일 수 가드: 한도에 가까우면 배포 전에 명확한 오류로 중단 (archive.mjs 의 LIVE_FULL/LIVE_LITE 를 줄이라는 신호)
// 3) _headers(캐시), ads.txt(AdSense), IndexNow 키 파일 생성
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'out');
const FILE_LIMIT = 20000;
const GUARD = Number(process.env.FILE_GUARD || 19000);

const isPayload = (name) => name === 'index.txt' || name.startsWith('__next.');

function strip(dir) {
  let removed = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.name === '_next') continue; // JS/CSS/폰트 번들은 유지
    if (isPayload(e.name)) { fs.rmSync(p, { recursive: true, force: true }); removed++; continue; }
    if (e.isDirectory()) removed += strip(p);
  }
  return removed;
}

function count(dir) {
  let n = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) n += e.isDirectory() ? count(path.join(dir, e.name)) : 1;
  return n;
}

if (fs.existsSync(OUT)) {
  console.log(`postbuild: ${strip(OUT)} RSC payload entries removed`);

  const key = process.env.INDEXNOW_KEY;
  if (key && /^[a-zA-Z0-9-]{8,128}$/.test(key)) fs.writeFileSync(path.join(OUT, `${key}.txt`), key);

  // AdSense 승인/수익 보호에 필요한 ads.txt (ca-pub-XXXX → pub-XXXX)
  const pub = (process.env.NEXT_PUBLIC_ADSENSE_ID || '').replace(/^ca-/, '');
  if (/^pub-\d+$/.test(pub)) fs.writeFileSync(path.join(OUT, 'ads.txt'), `google.com, ${pub}, DIRECT, f08c1fd8b5aeb4fa\n`);

  // Cloudflare Pages: 정적 자산 장기 캐시, HTML 은 짧게 (새 글이 빨리 보이도록)
  fs.writeFileSync(
    path.join(OUT, '_headers'),
    `/_next/static/*
  Cache-Control: public, max-age=31536000, immutable
/thumbs/*
  Cache-Control: public, max-age=2592000
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: interest-cohort=()
`,
  );

  const files = count(OUT);
  console.log(`postbuild: ${files} files in out/ (Cloudflare 한도 ${FILE_LIMIT})`);
  if (files > GUARD) {
    console.error(`postbuild: 파일 ${files}개 > 안전선 ${GUARD}. GitHub 변수 LIVE_FULL / LIVE_LITE 를 줄이세요 (scripts/archive.mjs).`);
    process.exit(1);
  }
}
