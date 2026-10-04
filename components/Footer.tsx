import Link from 'next/link';
import { CATEGORIES, SITE } from '@/lib/site';

export default function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr-grid">
          <div>
            <h3>{SITE.name}</h3>
            <p style={{ margin: 0 }}>{SITE.description}</p>
          </div>
          <div>
            <h3>หมวดหมู่</h3>
            <ul>{CATEGORIES.map((c) => <li key={c.slug}><Link href={`/category/${c.slug}/`}>{c.name}</Link></li>)}</ul>
          </div>
          <div>
            <h3>เกี่ยวกับเรา</h3>
            <ul>
              <li><Link href="/about/">เกี่ยวกับ {SITE.name}</Link></li>
              <li><Link href="/editorial-policy/">นโยบายกองบรรณาธิการ</Link></li>
              <li><Link href="/privacy/">นโยบายความเป็นส่วนตัว</Link></li>
              <li><Link href="/contact/">ติดต่อเรา / แจ้งแก้ไขข้อมูล</Link></li>
              <li><a href="/feed.xml">RSS Feed</a></li>
            </ul>
          </div>
        </div>
        <div className="ftr-bot">© {new Date().getFullYear()} {SITE.name} · เนื้อหาสรุปด้วยความช่วยเหลือของ AI จากแหล่งข่าวสาธารณะ พร้อมลิงก์อ้างอิงต้นทางทุกบทความ</div>
      </div>
    </footer>
  );
}
