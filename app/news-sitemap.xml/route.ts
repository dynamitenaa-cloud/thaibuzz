import { getPosts, postUrl } from '@/lib/posts';
import { SITE } from '@/lib/site';

export const dynamic = 'force-static';

const x = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

// Google News sitemap: เฉพาะบทความภายใน 48 ชั่วโมง
export function GET() {
  const cutoff = Date.now() - 48 * 3.6e6;
  const urls = getPosts()
    .filter((p) => Date.parse(p.createdAt) > cutoff)
    .slice(0, 1000)
    .map((p) => `<url><loc>${SITE.url}${postUrl(p)}</loc><news:news><news:publication><news:name>${x(SITE.name)}</news:name><news:language>th</news:language></news:publication><news:publication_date>${p.createdAt}</news:publication_date><news:title>${x(p.title)}</news:title></news:news><image:image><image:loc>${SITE.url}${p.thumb}</image:loc></image:image></url>`);
  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${urls.join('')}</urlset>`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8' } });
}
