import { CATEGORIES, SITE } from '@/lib/site';
import { FbIcon, InstagramIcon, ThreadsIcon, TikTokIcon, YouTubeIcon } from './Icons';

const SOCIAL = [
  { key: 'youtube', label: 'YouTube', Icon: YouTubeIcon },
  { key: 'facebook', label: 'Facebook', Icon: FbIcon },
  { key: 'instagram', label: 'Instagram', Icon: InstagramIcon },
  { key: 'threads', label: 'Threads', Icon: ThreadsIcon },
  { key: 'tiktok', label: 'TikTok', Icon: TikTokIcon },
] as const;

export default function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap">
        <div className="ftr-grid">
          <div>
            <h3>{SITE.name}</h3>
            <p style={{ margin: 0 }}>{SITE.description}</p>
            {/* 공식 소셜 계정 (설정된 것만 표시) */}
            {SOCIAL.some((x) => SITE.social[x.key]) && (
              <div className="social" aria-label="ติดตามเรา">
                <h3 style={{ marginTop: 18 }}>ติดตามเรา</h3>
                <div className="social-row">
                  {SOCIAL.filter((x) => SITE.social[x.key]).map(({ key, label, Icon }) => (
                    <a key={key} href={SITE.social[key]} target="_blank" rel="noopener me" aria-label={label} className={`soc soc-${key}`}><Icon width={22} height={22} /><span>{label}</span></a>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div>
            <h3>หมวดหมู่</h3>
            <ul>{CATEGORIES.map((c) => <li key={c.slug}><a href={`/category/${c.slug}/`}>{c.name}</a></li>)}<li><a href="/hub/">รวมคนดังและซีรีส์</a></li></ul>
          </div>
          <div>
            <h3>เกี่ยวกับเรา</h3>
            <ul>
              <li><a href="/about/">เกี่ยวกับ {SITE.name}</a></li>
              <li><a href="/editorial-policy/">นโยบายกองบรรณาธิการ</a></li>
              <li><a href="/privacy/">นโยบายความเป็นส่วนตัว</a></li>
              <li><a href="/terms/">ข้อกำหนดการใช้งาน</a></li>
              <li><a href="/contact/">ติดต่อเรา / แจ้งแก้ไขข้อมูล</a></li>
              <li><a href="/feed.xml">RSS Feed</a></li>
            </ul>
          </div>
        </div>
        <div className="ftr-bot">© {new Date().getFullYear()} {SITE.name} · เนื้อหาสรุปด้วยความช่วยเหลือของ AI จากแหล่งข่าวสาธารณะ พร้อมลิงก์อ้างอิงต้นทางทุกบทความ</div>
      </div>
    </footer>
  );
}
