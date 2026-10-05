import type { Metadata } from 'next';
import { og } from '@/lib/og';
import { SITE } from '@/lib/site';

// 이용약관 — 태국어 + 영어 (TikTok / YouTube 등 플랫폼 앱 검수 담당자가 영어로 검토)
const title = 'ข้อกำหนดการใช้งาน (Terms of Service)';
export const metadata: Metadata = { title, alternates: { canonical: '/terms/' }, openGraph: og('/terms/', title) };

const UPDATED = '5 ตุลาคม 2569 / October 5, 2026';

export default function Page() {
  const mail = <a href={`mailto:${SITE.email}`} style={{ textDecoration: 'underline' }}>{SITE.email}</a>;
  return (
    <div className="doc">
      <h1>{title}</h1>
      <p>ปรับปรุงล่าสุด / Last updated: {UPDATED}</p>

      <h2>ภาษาไทย</h2>
      <h3>1. เกี่ยวกับบริการ</h3>
      <p>{SITE.name} ({SITE.url}) เป็นเว็บไซต์สรุปข่าวและเทรนด์ในประเทศไทย บทความเรียบเรียงด้วยความช่วยเหลือของ AI จากแหล่งข่าวสาธารณะ และแสดงลิงก์แหล่งอ้างอิงในทุกบทความ เรายังเผยแพร่เนื้อหาของเราเองบนบัญชีโซเชียลมีเดียทางการของ {SITE.name} (Facebook, Instagram, Threads, TikTok, YouTube)</p>
      <h3>2. การใช้งานเนื้อหา</h3>
      <p>เนื้อหาบนเว็บไซต์มีไว้เพื่อให้ข้อมูลทั่วไปเท่านั้น ไม่ใช่คำแนะนำทางกฎหมาย การเงิน หรือการแพทย์ ผู้ใช้สามารถอ่านและแชร์ลิงก์บทความได้ แต่ห้ามคัดลอกเนื้อหาทั้งหมดไปเผยแพร่ซ้ำเพื่อการค้าโดยไม่ได้รับอนุญาต</p>
      <h3>3. ความถูกต้องของข้อมูล</h3>
      <p>เราพยายามนำเสนอเฉพาะข้อเท็จจริงจากแหล่งข่าวที่อ้างอิง แต่ไม่สามารถรับประกันความครบถ้วนหรือความถูกต้องทุกกรณี หากพบข้อผิดพลาด หรือเป็นบุคคลที่เกี่ยวข้องและต้องการให้แก้ไขหรือลบเนื้อหา โปรดติดต่อ {mail} เราจะตรวจสอบโดยเร็ว</p>
      <h3>4. ลิขสิทธิ์และทรัพย์สินทางปัญญา</h3>
      <p>ภาพและข้อมูลจากแหล่งข่าวเป็นลิขสิทธิ์ของเจ้าของเดิมและมีการระบุแหล่งที่มา หากท่านเป็นเจ้าของลิขสิทธิ์และต้องการให้นำเนื้อหาออก โปรดแจ้งที่ {mail}</p>
      <h3>5. ลิงก์ภายนอกและโฆษณา</h3>
      <p>เว็บไซต์มีลิงก์ไปยังเว็บไซต์อื่น ลิงก์พันธมิตร และโฆษณาจากบุคคลที่สาม เราไม่รับผิดชอบต่อเนื้อหาหรือนโยบายของเว็บไซต์เหล่านั้น</p>
      <h3>6. การเปลี่ยนแปลงข้อกำหนด</h3>
      <p>เราอาจปรับปรุงข้อกำหนดนี้เป็นครั้งคราว โดยจะแสดงวันที่ปรับปรุงล่าสุดไว้ด้านบน</p>

      <h2>English</h2>
      <h3>1. About the service</h3>
      <p>{SITE.name} ({SITE.url}) is a Thai-language news and trends summary website. Articles are written with AI assistance from publicly available news sources, and every article links to its sources. We also publish our own content (article summaries, images and short videos we create) to the official {SITE.name} accounts on Facebook, Instagram, Threads, TikTok and YouTube.</p>
      <h3>2. Use of content</h3>
      <p>Content is provided for general information only and is not legal, financial or medical advice. You may read and share links to our articles, but you may not republish our content in full for commercial purposes without permission.</p>
      <h3>3. Accuracy</h3>
      <p>We aim to present only facts reported by the cited sources, but we cannot guarantee completeness or accuracy in every case. To request a correction or removal, contact {mail}.</p>
      <h3>4. Copyright</h3>
      <p>Images and information from news sources remain the property of their owners and are credited. Copyright owners may request removal at {mail}.</p>
      <h3>5. Third-party platforms</h3>
      <p>When we publish to third-party platforms (Meta, TikTok, Google/YouTube) we only post our own content to our own accounts through their official APIs, and we follow each platform&apos;s terms of service and community guidelines. We do not access, collect or store any data of other users of those platforms.</p>
      <h3>YouTube</h3>
      <p>Our videos on YouTube are published using YouTube API Services. By viewing them you agree to be bound by the <a href="https://www.youtube.com/t/terms" style={{ textDecoration: 'underline' }}>YouTube Terms of Service</a>. See also the <a href="https://policies.google.com/privacy" style={{ textDecoration: 'underline' }}>Google Privacy Policy</a> and our <a href="/privacy/#youtube" style={{ textDecoration: 'underline' }}>Privacy Policy (YouTube section)</a>.</p>
      <h3>6. Changes</h3>
      <p>We may update these terms from time to time. The last updated date is shown above.</p>
      <h3>Contact</h3>
      <p>{mail}</p>
    </div>
  );
}
