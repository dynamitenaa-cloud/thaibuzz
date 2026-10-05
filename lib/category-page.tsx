import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPosts } from './posts';
import { categoryBySlug, SITE } from './site';
import { Listing, pageCount } from '@/components/Listing';
import JsonLd from '@/components/JsonLd';
import { og } from './og';

export const categoryIndexable = (count: number) => count >= 3;

export function categoryMeta(slug: string, page = 1): Metadata {
  const c = categoryBySlug(slug);
  if (!c) return {};
  const path = page > 1 ? `/category/${slug}/page/${page}/` : `/category/${slug}/`;
  const count = getPosts().filter((p) => p.category === c.name).length;
  // หน้าว่าง/บาง ไม่ให้ index (กัน thin content) — sitemap.ts 도 같은 기준(categoryIndexable) 사용
  const thin = page > pageCount(count) || !categoryIndexable(count);
  // "ข่าวทั่วไป" 처럼 이미 "ข่าว" 로 시작하는 이름에 접두어가 중복되지 않게
  const label = c.name.startsWith('ข่าว') ? c.name : `ข่าว${c.name}`;
  const title = `${label}ล่าสุด${page > 1 ? ` หน้า ${page}` : ''}`;
  return {
    robots: thin ? { index: false, follow: true } : undefined,
    title,
    description: `รวม${label} ประเด็นร้อนและเทรนด์ล่าสุดที่คนไทยกำลังพูดถึง อัปเดตตลอด 24 ชั่วโมง`,
    alternates: { canonical: path },
    openGraph: og(path, title),
  };
}

export function CategoryView({ slug, page }: { slug: string; page: number }) {
  const c = categoryBySlug(slug);
  if (!c) notFound();
  const posts = getPosts().filter((p) => p.category === c.name);
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: c.name, item: `${SITE.url}/category/${c.slug}/` },
      ] }} />
      <div className="ph">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li>{c.name}</li></ol></nav>
        <h1>{c.emoji} {c.name}</h1>
        <p>{posts.length} บทความ{page > 1 ? ` · หน้า ${page}` : ''}</p>
      </div>
      <Listing posts={posts} base={`/category/${c.slug}/`} page={page} />
    </>
  );
}
