import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getDraws, thaiLong, thaiShort } from '@/lib/live';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import JsonLd from '@/components/JsonLd';
import { DrawView } from '@/components/Lottery';

type P = { params: Promise<{ date: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => {
  const s = getDraws().map((d) => ({ date: d.date }));
  return s.length ? s : [{ date: '_' }];
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { date } = await params;
  const all = getDraws();
  const d = all.find((x) => x.date === date);
  if (!d) return { robots: { index: false } };
  const latest = all[0].date === date;
  const title = `ผลสลากกินแบ่งรัฐบาล งวด ${thaiShort(d.date)}`;
  const description = `ผลสลากกินแบ่งรัฐบาลงวดวันที่ ${thaiLong(d.date)} รางวัลที่ 1 ${d.prizes.first.numbers[0]} เลขท้าย 2 ตัว ${d.prizes.last2?.numbers[0] ?? '-'} ครบทุกรางวัล`;
  // 최신 회차는 /lottery/ 가 대표 페이지 (같은 내용 중복 방지)
  return { title, description, alternates: { canonical: latest ? '/lottery/' : `/lottery/${d.date}/` }, openGraph: og(`/lottery/${d.date}/`, title, { description }) };
}

export default async function Page({ params }: P) {
  const { date } = await params;
  const all = getDraws();
  const d = all.find((x) => x.date === date);
  if (!d) notFound();
  const title = `ผลสลากกินแบ่งรัฐบาล งวดวันที่ ${thaiLong(d.date)}`;
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url }, { '@type': 'ListItem', position: 2, name: 'ตรวจหวย', item: `${SITE.url}/lottery/` }, { '@type': 'ListItem', position: 3, name: `งวด ${thaiShort(d.date)}`, item: `${SITE.url}/lottery/${d.date}/` }] }} />
      <div className="doc lot">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li><a href="/lottery/">ตรวจหวย</a></li><li>งวด {thaiShort(d.date)}</li></ol></nav>
        <h1>{title}</h1>
        {all[0].date !== d.date && <p className="lede">นี่คือผลงวดก่อนหน้า ดู <a href="/lottery/" style={{ textDecoration: 'underline' }}>ผลสลากงวดล่าสุด</a></p>}
        <DrawView draw={d} all={all} latest={all[0].date === d.date} />
      </div>
    </>
  );
}
