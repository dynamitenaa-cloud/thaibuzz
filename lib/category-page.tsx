import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPosts } from './posts';
import { categoryBySlug, SITE } from './site';
import { Listing, pageCount } from '@/components/Listing';
import JsonLd from '@/components/JsonLd';

export function categoryMeta(slug: string, page = 1): Metadata {
  const c = categoryBySlug(slug);
  if (!c) return {};
  const path = page > 1 ? `/category/${slug}/page/${page}/` : `/category/${slug}/`;
  const count = getPosts().filter((p) => p.category === c.name).length;
  // หน้าว่าง/บาง ไม่ให้ index (กัน thin content)
  const thin = page > pageCount(count) || count < 3;
  return {
    robots: thin ? { index: false, follow: true } : undefined,
    title: `ข่าว${c.name}ล่าสุด${page > 1 ? ` หน้า ${page}` : ''}`,
    description: `รวมข่าว${c.name} ประเด็นร้อนและเทรนด์ล่าสุดที่คนไทยกำลังพูดถึง อัปเดตตลอด 24 ชั่วโมง`,
    alternates: { canonical: path },
    openGraph: { url: path },
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
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><Link href="/">หน้าแรก</Link></li><li>{c.name}</li></ol></nav>
        <h1>{c.emoji} {c.name}</h1>
        <p>{posts.length} บทความ{page > 1 ? ` · หน้า ${page}` : ''}</p>
      </div>
      <Listing posts={posts} base={`/category/${c.slug}/`} page={page} />
    </>
  );
}
