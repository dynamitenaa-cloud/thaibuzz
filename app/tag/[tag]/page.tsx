import type { Metadata } from 'next';
import { getPosts, getTags, MIN_TAG_POSTS, tagSlug } from '@/lib/posts';
import { Listing } from '@/components/Listing';
import { og } from '@/lib/og';

type P = { params: Promise<{ tag: string }> };

// 글이 MIN_TAG_POSTS 개 이상인 태그만 페이지 생성 (빈약한 페이지 방지 + Cloudflare 파일 수 절약)
const linkable = () => [...getTags()].filter(([, t]) => t.count >= MIN_TAG_POSTS);

export const dynamicParams = false;
export const generateStaticParams = () => {
  const keys = linkable().map(([s]) => s);
  return keys.length ? keys.map((tag) => ({ tag })) : [{ tag: '_' }];
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { tag } = await params;
  const t = getTags().get(tag);
  if (!t || t.count < MIN_TAG_POSTS) return { robots: { index: false } };
  const path = `/tag/${tag}/`;
  return {
    title: `#${t.tag} ข่าวล่าสุด`,
    description: `รวมข่าวและประเด็นล่าสุดเกี่ยวกับ ${t.tag}`,
    alternates: { canonical: path },
    openGraph: og(path, `#${t.tag} ข่าวล่าสุด`),
  };
}

export default async function Page({ params }: P) {
  const { tag } = await params;
  const t = getTags().get(tag);
  const posts = t ? getPosts().filter((p) => p.tags.some((x) => tagSlug(x) === tag)) : [];
  return (
    <>
      <div className="ph">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li>แท็ก</li></ol></nav>
        <h1>#{t?.tag ?? 'ไม่พบแท็ก'}</h1>
        <p>{posts.length} บทความ</p>
      </div>
      {/* 태그 페이지는 /page/n/ 경로가 없으므로 전부 표시 */}
      <Listing posts={posts} base={`/tag/${tag}/`} page={1} all />
    </>
  );
}
