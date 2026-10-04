// 새 URL 을 IndexNow 에 알림 (Bing·Yandex·Naver·Seznam 공용, 무료). 키 파일은 postbuild 가 out/<key>.txt 로 생성
import fs from 'node:fs';

const key = process.env.INDEXNOW_KEY;
const site = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const file = '.cache/new-urls.txt';
if (!key || !site || !fs.existsSync(file)) process.exit(0);

const paths = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean);
if (!paths.length) process.exit(0);
const urlList = [...paths, '/'].map((p) => site + p);

const r = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${key}.txt`, urlList }),
});
console.log(`indexnow: ${r.status} (${urlList.length} urls)`);
