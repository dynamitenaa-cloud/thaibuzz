import type { Metadata } from 'next';
import { getDraws, thaiLong, thaiShort } from '@/lib/live';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import JsonLd from '@/components/JsonLd';
import { DrawView } from '@/components/Lottery';

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  const d = getDraws()[0];
  const title = d ? `ตรวจหวย ผลสลากกินแบ่งรัฐบาล งวด ${thaiShort(d.date)}` : 'ตรวจหวย ผลสลากกินแบ่งรัฐบาล งวดล่าสุด';
  const description = d
    ? `ผลสลากกินแบ่งรัฐบาลงวดวันที่ ${thaiLong(d.date)} รางวัลที่ 1 ${d.prizes.first.numbers[0]} เลขท้าย 2 ตัว ${d.prizes.last2?.numbers[0] ?? '-'} เลขหน้า 3 ตัว ${d.prizes.last3f?.numbers.join(' ') ?? '-'} เลขท้าย 3 ตัว ${d.prizes.last3b?.numbers.join(' ') ?? '-'} พร้อมตรวจหวยด้วยเลข 6 หลัก`
    : 'ผลสลากกินแบ่งรัฐบาลงวดล่าสุด ครบทุกรางวัล พร้อมเครื่องมือตรวจหวย';
  return { title, description, alternates: { canonical: '/lottery/' }, openGraph: og('/lottery/', title, { description }), robots: d ? undefined : { index: false } };
}

export default function Page() {
  const all = getDraws();
  const d = all[0];
  if (!d) return <div className="empty"><b>🎱</b><p>กำลังรวบรวมผลสลาก… กลับมาอีกครั้งเร็ว ๆ นี้</p></div>;
  const title = `ผลสลากกินแบ่งรัฐบาล งวดวันที่ ${thaiLong(d.date)}`;
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@graph': [
        { '@type': 'WebPage', name: title, url: `${SITE.url}/lottery/`, dateModified: d.fetchedAt, isPartOf: { '@id': `${SITE.url}/#web` }, about: 'สลากกินแบ่งรัฐบาล' },
        { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url }, { '@type': 'ListItem', position: 2, name: 'ตรวจหวย', item: `${SITE.url}/lottery/` }] },
      ] }} />
      <div className="doc lot">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li>ตรวจหวย</li></ol></nav>
        <h1>{title}</h1>
        <p className="lede">ผลรางวัลครบทุกรางวัลจากสำนักงานสลากกินแบ่งรัฐบาล อัปเดตอัตโนมัติหลังการออกรางวัล พิมพ์เลข 6 หลักเพื่อตรวจหวยได้ทันที</p>
        <DrawView draw={d} all={all} latest />
      </div>
    </>
  );
}
