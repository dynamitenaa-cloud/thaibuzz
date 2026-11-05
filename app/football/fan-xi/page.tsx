import type { Metadata } from 'next';
import { getXi, PLAYER_LEAGUES } from '@/lib/football-xi';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import { FanXI } from '@/components/FanXI';
import JsonLd from '@/components/JsonLd';

export const dynamic = 'force-static';
const title = 'Fan XI ประจำสัปดาห์ โหวตทีม 11 คนยอดเยี่ยม พรีเมียร์ลีก ลาลีกา เซเรีย อา บุนเดสลีกา';
export const metadata: Metadata = {
  title,
  description: 'ใครคือนักเตะที่ดีที่สุดของสัปดาห์? โหวตเลือกผู้รักษาประตู กองหลัง กองกลาง กองหน้า จากสถิติจริง แล้วดูทีม 11 คนที่แฟนบอลไทยเลือกร่วมกัน',
  alternates: { canonical: '/football/fan-xi/' },
  openGraph: og('/football/fan-xi/', title),
};

export default function Page() {
  const xi = getXi();
  const leagues = xi ? PLAYER_LEAGUES.filter((l) => xi.leagues[l.slug]).map((l) => ({ slug: l.slug, name: l.name, matches: xi.leagues[l.slug].matches, positions: xi.leagues[l.slug].positions })) : [];
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url }, { '@type': 'ListItem', position: 2, name: 'ตารางบอล', item: `${SITE.url}/football/` }, { '@type': 'ListItem', position: 3, name: 'Fan XI', item: `${SITE.url}/football/fan-xi/` }] }} />
      <div className="doc fb">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li><a href="/football/">ตารางบอล</a></li><li>Fan XI</li></ol></nav>
        <h1>🏆 Fan XI ประจำสัปดาห์</h1>
        <p className="lede">เลือกนักเตะที่คุณคิดว่าเล่นดีที่สุดในสัปดาห์ที่ผ่านมา ตามแผน 4-3-3 รายชื่อผู้เข้าชิงคัดจากสถิติจริง (ประตู แอสซิสต์ คลีนชีต เซฟ) แล้วดูว่าทีมในฝันของแฟนบอลไทยออกมาเป็นยังไง ผลโหวตอัปเดตทันที</p>
        {leagues.length ? <FanXI round={xi!.round} label={xi!.label} leagues={leagues} /> : <p>รายชื่อผู้เข้าชิงรอบนี้กำลังเตรียม กลับมาดูใหม่หลังจันทร์นี้นะครับ</p>}
        <p className="pm-more">เล่นต่อ: <a href="/football/predict/">🎯 ทายผลก่อนเตะ</a> · <a href="/football/best11/">⚽ สร้าง BEST 11 ของคุณ</a></p>
      </div>
    </>
  );
}
