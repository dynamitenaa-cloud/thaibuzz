import type { Metadata } from 'next';
import { homeFeed } from '@/lib/posts';
import { Listing, pageCount, pageParams } from '@/components/Listing';
import { og } from '@/lib/og';

// 홈(/)과 같은 목록(rest)을 페이지 단위로 이어서 보여줌 → 겹치거나 빠지는 글 없음
export const dynamicParams = false;
export const generateStaticParams = () => pageParams(homeFeed().rest.length);

export async function generateMetadata({ params }: { params: Promise<{ n: string }> }): Promise<Metadata> {
  const { n } = await params;
  const empty = Number(n) > pageCount(homeFeed().rest.length);
  const path = `/page/${n}/`;
  return {
    title: `ข่าวล่าสุด หน้า ${n}`,
    alternates: { canonical: path },
    openGraph: og(path, `ข่าวล่าสุด หน้า ${n}`),
    robots: empty ? { index: false, follow: true } : undefined,
  };
}

export default async function Page({ params }: { params: Promise<{ n: string }> }) {
  const n = Number((await params).n);
  return (
    <>
      <div className="ph"><h1>ข่าวล่าสุด</h1><p>หน้า {n}</p></div>
      <Listing posts={homeFeed().rest} base="/" page={n} />
    </>
  );
}
