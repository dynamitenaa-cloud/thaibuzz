import type { MetadataRoute } from 'next';
import { getPosts, getTags, MIN_HUB_INDEX, postUrl } from '@/lib/posts';
import { CATEGORIES, SITE } from '@/lib/site';
import { editorUrl } from '@/lib/editor';
import { getDraws, getGold } from '@/lib/live';
import { getLeagueData, LEAGUES } from '@/lib/football';
import { categoryIndexable } from '@/lib/category-page';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getPosts();
  const latest = posts[0]?.createdAt;
  const draws = getDraws();
  const gold = getGold();
  return [
    ...(draws.length ? [{ url: `${SITE.url}/lottery/`, lastModified: draws[0].fetchedAt, changeFrequency: 'daily' as const, priority: 0.9 }, ...draws.slice(1).map((d) => ({ url: `${SITE.url}/lottery/${d.date}/`, lastModified: d.fetchedAt, priority: 0.5 }))] : []),
    { url: `${SITE.url}/football/`, changeFrequency: 'hourly' as const, priority: 0.9 },
    ...LEAGUES.filter((l) => getLeagueData(l.slug)).map((l) => ({ url: `${SITE.url}/football/${l.slug}/`, lastModified: getLeagueData(l.slug)!.updatedAt, changeFrequency: 'hourly' as const, priority: 0.85 })),
    ...(gold.items.length ? [{ url: `${SITE.url}/gold/`, lastModified: gold.updatedAt, changeFrequency: 'hourly' as const, priority: 0.9 }] : []),
    { url: `${SITE.url}/`, lastModified: latest, changeFrequency: 'hourly', priority: 1 },
    ...CATEGORIES.filter((c) => categoryIndexable(posts.filter((p) => p.category === c.name).length)).map((c) => ({ url: `${SITE.url}/category/${c.slug}/`, lastModified: posts.find((p) => p.category === c.name)?.createdAt, changeFrequency: 'hourly' as const, priority: 0.8 })),
    ...posts.map((p) => ({ url: `${SITE.url}${postUrl(p)}`, lastModified: p.updatedAt ?? p.createdAt, priority: 0.7, ...(p.thumb ? { images: [`${SITE.url}${p.thumb}`] } : {}) })),
    ...[...getTags()].filter(([, t]) => t.count >= MIN_HUB_INDEX).map(([s]) => ({ url: `${SITE.url}/tag/${s}/`, priority: 0.4 })),
    { url: `${SITE.url}/hub/`, changeFrequency: 'daily' as const, priority: 0.6 },
    { url: `${SITE.url}${editorUrl()}`, lastModified: latest, priority: 0.5 },
    ...['about', 'editorial-policy', 'privacy', 'terms', 'contact'].map((s) => ({ url: `${SITE.url}/${s}/`, priority: 0.2 })),
  ];
}
