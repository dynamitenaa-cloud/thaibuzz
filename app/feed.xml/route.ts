import { getPosts, postUrl } from '@/lib/posts';
import { SITE } from '@/lib/site';

export const dynamic = 'force-static';

const x = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);

export function GET() {
  const items = getPosts().slice(0, 50).map((p) => {
    const url = `${SITE.url}${postUrl(p)}`;
    return `<item><title>${x(p.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid><pubDate>${new Date(p.createdAt).toUTCString()}</pubDate><category>${x(p.category)}</category><description>${x(p.excerpt)}</description><enclosure url="${SITE.url}${p.thumb}" type="image/jpeg" length="0"/></item>`;
  });
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>${x(SITE.name)}</title><link>${SITE.url}</link><description>${x(SITE.description)}</description><language>th</language><atom:link href="${SITE.url}/feed.xml" rel="self" type="application/rss+xml"/>${items.join('')}</channel></rss>`;
  return new Response(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8' } });
}
