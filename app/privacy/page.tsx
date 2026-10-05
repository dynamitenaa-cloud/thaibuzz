import type { Metadata } from 'next';
import { og } from '@/lib/og';
import { SITE } from '@/lib/site';

export const metadata: Metadata = { title: 'นโยบายความเป็นส่วนตัว', alternates: { canonical: '/privacy/' }, openGraph: og('/privacy/', 'นโยบายความเป็นส่วนตัว') };

export default function Page() {
  return (
    <div className="doc">
      <h1>นโยบายความเป็นส่วนตัว</h1>
      <p>{SITE.name} ให้ความสำคัญกับความเป็นส่วนตัวของผู้ใช้งานตามพระราชบัญญัติคุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 (PDPA)</p>
      <h2>ข้อมูลที่เราเก็บ</h2>
      <p>เราไม่มีระบบสมัครสมาชิกและไม่เก็บข้อมูลส่วนบุคคลโดยตรง อย่างไรก็ตาม บริการของบุคคลที่สามที่เราใช้อาจเก็บข้อมูลการใช้งาน เช่น ที่อยู่ IP ประเภทอุปกรณ์ และพฤติกรรมการเข้าชม ผ่านคุกกี้</p>
      <h2>คุกกี้และโฆษณา</h2>
      <p>เราใช้ Google AdSense ในการแสดงโฆษณา Google และพาร์ทเนอร์อาจใช้คุกกี้เพื่อแสดงโฆษณาตามการเข้าชมเว็บไซต์นี้และเว็บไซต์อื่นของคุณ คุณสามารถปิดการโฆษณาตามความสนใจได้ที่ <a href="https://adssettings.google.com" style={{ textDecoration: 'underline' }}>Google Ads Settings</a> และอ่านเพิ่มเติมที่ <a href="https://policies.google.com/technologies/ads" style={{ textDecoration: 'underline' }}>นโยบายโฆษณาของ Google</a></p>
      <h2>การวิเคราะห์การใช้งาน</h2>
      <p>เราอาจใช้ Google Analytics เพื่อวัดสถิติการเข้าชมแบบไม่ระบุตัวตน เพื่อปรับปรุงเนื้อหาและประสบการณ์การใช้งาน</p>
      <h2>ลิงก์พันธมิตร</h2>
      <p>บางบทความมีลิงก์พันธมิตร (เช่น Shopee) หากคุณซื้อสินค้าผ่านลิงก์ เราอาจได้รับค่าคอมมิชชันโดยไม่มีค่าใช้จ่ายเพิ่มเติมสำหรับคุณ</p>
      <h2>แพลตฟอร์มโซเชียลมีเดียที่เชื่อมต่อ</h2>
      <p>เราใช้ API ทางการของ Meta (Facebook, Instagram, Threads), TikTok และ Google (YouTube) เพื่อเผยแพร่เนื้อหาของเราเองไปยังบัญชีทางการของ {SITE.name} เท่านั้น เราไม่เข้าถึง ไม่เก็บ และไม่ประมวลผลข้อมูลของผู้ใช้รายอื่นบนแพลตฟอร์มเหล่านั้น โทเค็นการเข้าถึงของบัญชีเราถูกเก็บแบบเข้ารหัสในระบบอัตโนมัติและใช้เพื่อการเผยแพร่เท่านั้น</p>

      <h2>English summary</h2>
      <p>{SITE.name} does not offer user accounts and does not directly collect personal data. Third-party services we use (Google AdSense, Google Analytics / Cloudflare Web Analytics) may use cookies or anonymous usage data as described in their own policies.</p>
      <p><b>Connected platforms:</b> we use the official APIs of Meta (Facebook, Instagram, Threads), TikTok and Google (YouTube) solely to publish our own content to the official {SITE.name} accounts. We do not access, collect, store or share any data about other users of those platforms. Access tokens for our own accounts are stored encrypted in our automation system and used only for publishing. To request deletion of any data or content, contact {SITE.email}.</p>

      <h2 id="youtube">YouTube API Services</h2>
      <p>{SITE.name} uses <b>YouTube API Services</b> to upload short videos created from our own articles to our own official YouTube channel. By watching our videos on YouTube you are also subject to the <a href="https://www.youtube.com/t/terms" style={{ textDecoration: 'underline' }}>YouTube Terms of Service</a>, and Google&apos;s handling of data is described in the <a href="https://policies.google.com/privacy" style={{ textDecoration: 'underline' }}>Google Privacy Policy</a>.</p>
      <ul>
        <li><b>Data we access:</b> only our own channel, with the single permission <code>youtube.upload</code> (upload videos). We do not read, collect or store any data about YouTube viewers or other channels.</li>
        <li><b>Data we store:</b> only the IDs of videos we uploaded (to avoid duplicate uploads) and our own encrypted OAuth credentials. Nothing is shared with or sold to third parties.</li>
        <li><b>Revoking access &amp; deletion:</b> the channel owner can revoke our app&apos;s access at any time on the <a href="https://security.google.com/settings/security/permissions" style={{ textDecoration: 'underline' }}>Google security settings page</a>. Stored upload records are deleted within 30 days after access is revoked, or immediately on request to {SITE.email}.</li>
      </ul>
      <p>ภาษาไทย: {SITE.name} ใช้ YouTube API Services เพื่ออัปโหลดวิดีโอสั้นของเราเองไปยังช่อง YouTube ทางการของเรา โดยไม่เก็บข้อมูลของผู้ชมหรือช่องอื่น การรับชมบน YouTube อยู่ภายใต้ <a href="https://www.youtube.com/t/terms" style={{ textDecoration: 'underline' }}>ข้อกำหนดการให้บริการของ YouTube</a> และ <a href="https://policies.google.com/privacy" style={{ textDecoration: 'underline' }}>นโยบายความเป็นส่วนตัวของ Google</a></p>

      <h2>ติดต่อ</h2>
      <p>สอบถามเกี่ยวกับนโยบายนี้: <a href={`mailto:${SITE.email}`} style={{ textDecoration: 'underline' }}>{SITE.email}</a></p>
    </div>
  );
}
