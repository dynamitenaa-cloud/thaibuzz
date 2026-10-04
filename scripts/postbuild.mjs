// Next 16 static export 는 RSC prefetch 파일을 `__next.post/$d$slug/__PAGE__.txt` 처럼 폴더로 쓰지만
// 클라이언트는 `__next.post.$d$slug.__PAGE__.txt` 로 요청한다 → 정적 호스트에서 404.
// 점(.)으로 이어 붙인 평탄화 사본을 만들어 클라이언트 내비게이션/프리페치가 정상 동작하게 한다.
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(process.cwd(), 'out');
let n = 0;

function flatten(dir, prefix, target) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    const name = `${prefix}.${e.name}`;
    if (e.isDirectory()) flatten(p, name, target);
    else { fs.copyFileSync(p, path.join(target, name)); n++; }
  }
}

function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    const p = path.join(dir, e.name);
    if (e.name.startsWith('__next.')) flatten(p, e.name, dir);
    else if (e.name !== '_next') walk(p);
  }
}

if (fs.existsSync(OUT)) {
  walk(OUT);
  console.log(`postbuild: ${n} RSC segment files flattened`);

  // IndexNow 소유 확인용 키 파일
  const key = process.env.INDEXNOW_KEY;
  if (key && /^[a-zA-Z0-9-]{8,128}$/.test(key)) fs.writeFileSync(path.join(OUT, `${key}.txt`), key);

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
}
