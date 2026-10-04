import { getPosts } from '@/lib/posts';

export const dynamic = 'force-static';

export function GET() {
  return Response.json(
    getPosts().map((p) => ({ s: p.slug, t: p.title, e: p.excerpt, k: p.keyword, g: p.tags, c: p.category, i: p.thumbSm, d: p.createdAt })),
  );
}
