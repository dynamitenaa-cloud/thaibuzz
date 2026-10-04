import type { Metadata } from 'next';
import { getPosts } from '@/lib/posts';
import { Listing, pageCount, pageParams } from '@/components/Listing';

export const dynamicParams = false;
export const generateStaticParams = () => pageParams(getPosts().length);

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const { n } = await params;
  const empty = Number(n) > pageCount(getPosts().length);
  return { title: `ข่าวล่าสุด หน้า ${n}`, alternates: { canonical: `/page/${n}/` }, robots: empty ? { index: false } : undefined };
}

export default async function Page({ params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n);
  return (
    <>
      <div className="ph"><h1>ข่าวล่าสุด</h1><p>หน้า {n}</p></div>
      <Listing posts={getPosts()} base="/" page={n} />
    </>
  );
}
