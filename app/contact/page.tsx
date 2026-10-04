import type { Metadata } from 'next';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'ติดต่อเรา', alternates: { canonical: '/contact/' } };

export default function Page() {
  return (
    <div className="doc">
      <h1>ติดต่อเรา</h1>
      <p>เรายินดีรับฟังทุกความคิดเห็น</p>
      <h2>แจ้งแก้ไขข้อมูล / ขอลบเนื้อหา</h2>
      <p>โปรดระบุลิงก์บทความและรายละเอียดที่ต้องการแก้ไข เราจะตรวจสอบภายใน 24–48 ชั่วโมง</p>
      <h2>ติดต่อโฆษณาและความร่วมมือ</h2>
      <p>อีเมล: <a href={`mailto:${SITE.email}`} style={{ textDecoration: 'underline' }}>{SITE.email}</a></p>
      <p><a className="btn" href={`mailto:${SITE.email}?subject=${encodeURIComponent(`[${SITE.name}] ติดต่อ`)}`}>✉️ ส่งอีเมลถึงเรา</a></p>
    </div>
  );
}
