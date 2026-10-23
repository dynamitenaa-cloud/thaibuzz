import fs from 'node:fs';
import { cache } from 'react';
import { SITE } from './site';

// 글별 페이스북 게시물 링크. scripts/facebook.mjs 가 게시 후 .cache/fb-posted.json 의 ids.photo[slug] 에 게시물 ID 를 남기고,
// 다음 빌드(Actions 캐시 복원 후)가 읽어 "คอมเมนต์บน Facebook" 버튼을 그 게시물로 연결. 없으면 페이지로.
const ids = cache((): Record<string, string> => {
  try { return JSON.parse(fs.readFileSync('.cache/fb-posted.json', 'utf8')).ids?.photo ?? {}; } catch { return {}; }
});

export function fbPostUrl(slug: string): { url: string; direct: boolean } {
  const id = ids()[slug];
  if (id) {
    const [page, post] = String(id).split('_');
    return { url: post ? `https://www.facebook.com/${page}/posts/${post}` : `https://www.facebook.com/${id}`, direct: true };
  }
  return { url: SITE.social.facebook || '', direct: false };
}
