import type { Metadata } from 'next';
import Link from 'next/link';
import { getPosts, getTags, tagSlug } from '@/lib/posts';
import { Listing } from '@/components/Listing';
import { SITE } from '@/lib/site';

type P = { params: Promise<{ tag: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => {
  const keys = [...getTags().keys()];
  return keys.length ? keys.map((tag) => ({ tag })) : [{ tag: '_' }];
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { tag } = await params;
  const t = getTags().get(tag);
  if (!t) return { robots: { index: false } };
  return {
    title: `#${t.tag} ข่าวล่าสุด`,
    description: `รวมข่าวและประเด็นล่าสุดเกี่ยวกับ ${t.tag}`,
    alternates: { canonical: `/tag/${tag}/` },
    // แท็กที่มีบทความเดียวยังบาง → noindex กันหน้า thin content
    robots: { index: t.count >= 2, follow: true },
  };
}

export default async function Page({ params }: P) {
  const { tag } = await params;
  const t = getTags().get(tag);
  const posts = t ? getPosts().filter((p) => p.tags.some((x) => tagSlug(x) === tag)) : [];
  return (
    <>
      <div className="ph">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><Link href="/">หน้าแรก</Link></li><li>แท็ก</li></ol></nav>
        <h1>#{t?.tag ?? 'ไม่พบแท็ก'}</h1>
        <p>{posts.length} บทความ</p>
      </div>
      <Listing posts={posts.slice(0, SITE.perPage)} base={`/tag/${tag}/`} page={1} />
    </>
  );
}
