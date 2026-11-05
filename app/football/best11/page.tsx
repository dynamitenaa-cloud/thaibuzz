import type { Metadata } from 'next';
import { getRosters, PLAYER_LEAGUES } from '@/lib/football-xi';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import { Best11 } from '@/components/Best11';
import JsonLd from '@/components/JsonLd';

export const dynamic = 'force-static';
const title = 'สร้าง BEST 11 ของคุณ เลือกนักเตะในฝัน แล้วแชร์ให้เพื่อน';
export const metadata: Metadata = {
  title,
  description: 'จัดทีม 11 คนในฝันจากนักเตะพรีเมียร์ลีก ลาลีกา เซเรีย อา บุนเดสลีกา เลือกแผน เลือกตัว (ผสมลีกได้) แล้วบันทึกเป็นรูปแชร์ลง Facebook หรือ LINE ฟรี',
  alternates: { canonical: '/football/best11/' },
  openGraph: og('/football/best11/', title),
};

export default function Page() {
  const r = getRosters();
  const leagues = PLAYER_LEAGUES.filter((l) => r?.leagues[l.slug]?.length).map((l) => ({ slug: l.slug, name: l.name }));
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url }, { '@type': 'ListItem', position: 2, name: 'ตารางบอล', item: `${SITE.url}/football/` }, { '@type': 'ListItem', position: 3, name: 'BEST 11', item: `${SITE.url}/football/best11/` }] }} />
      <div className="doc fb">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li><a href="/football/">ตารางบอล</a></li><li>BEST 11</li></ol></nav>
        <h1>⚽ สร้าง BEST 11 ของคุณ</h1>
        <p className="lede">เลือกแผน กดที่ตำแหน่งในสนามเพื่อเลือกนักเตะ (สลับลีกเพื่อจัดทีมผสมได้) ครบ 11 คนแล้วกด “แชร์ทีมของฉัน” เพื่อได้รูปไปโพสต์ ทีมของคุณจะถูกจำไว้ในเบราว์เซอร์นี้</p>
        {leagues.length ? <Best11 leagues={leagues} /> : <p>รายชื่อนักเตะกำลังเตรียม กลับมาดูใหม่ภายหลังนะครับ</p>}
        <p className="pm-more">เล่นต่อ: <a href="/football/predict/">🎯 ทายผลก่อนเตะ</a> · <a href="/football/fan-xi/">🏆 โหวต Fan XI ประจำสัปดาห์</a></p>
        <p className="pm-rule">ชื่อนักเตะจากข้อมูลสาธารณะของ ESPN · ThaiBuzz ไม่มีส่วนเกี่ยวข้องกับสโมสรหรือนักเตะ</p>
      </div>
    </>
  );
}
