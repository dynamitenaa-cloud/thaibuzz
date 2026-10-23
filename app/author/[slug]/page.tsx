import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getPosts, thaiDate } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import { EDITOR, editorId, editorUrl } from '@/lib/editor';
import { Card } from '@/components/PostCard';
import JsonLd from '@/components/JsonLd';

export const dynamicParams = false;
export const generateStaticParams = () => [{ slug: EDITOR.slug }];

const title = `${EDITOR.name} — บรรณาธิการ`;

export const metadata: Metadata = {
  title,
  description: EDITOR.bio[0],
  alternates: { canonical: editorUrl() },
  openGraph: og(editorUrl(), title, { type: 'profile', images: [{ url: EDITOR.photoJpg, width: 640, height: 640, alt: EDITOR.name }] }),
};

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  if ((await params).slug !== EDITOR.slug) notFound();
  const all = getPosts();
  const noted = all.filter((p) => p.editorNote).slice(0, 6);
  const latest = all.filter((p) => !noted.includes(p)).slice(0, 8);
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'ProfilePage', mainEntity: { '@id': editorId() }, dateModified: all[0]?.createdAt }} />
      <div className="doc author">
        <header className="author-h">
          <img src={EDITOR.photo} alt={EDITOR.name} width={160} height={160} />
          <div>
            <h1>{EDITOR.name}</h1>
            <p className="author-sub">{EDITOR.nameEn} · {EDITOR.jobTitle}และผู้ก่อตั้ง {SITE.name}</p>
            <p className="author-sub">🇰🇷 จาก{EDITOR.hometown} · 🇹🇭 อยู่ไทย {EDITOR.yearsInThailand} ปี</p>
          </div>
        </header>
        {EDITOR.bio.map((t, i) => <p key={i}>{t}</p>)}
        <h2>วิธีทำงานของเรา</h2>
        <ul>
          <li>เนื้อข่าวเรียบเรียงด้วยความช่วยเหลือของ AI จากสื่อที่เผยแพร่ต่อสาธารณะอย่างน้อย 2 แห่ง ทุกบทความแสดงลิงก์ต้นทาง</li>
          <li>กล่อง "มุมมองจากบรรณาธิการชาวเกาหลี" เขียนโดยบรรณาธิการเอง ไม่ใช่ AI</li>
          <li>พบข้อผิดพลาด แจ้งได้ที่ <a href="/contact/" style={{ textDecoration: 'underline' }}>หน้าติดต่อ</a> เราแก้ไขและระบุวันที่แก้ไขในบทความ</li>
        </ul>
        <p>อ่าน <a href="/editorial-policy/" style={{ textDecoration: 'underline' }}>นโยบายกองบรรณาธิการ</a> ฉบับเต็ม</p>
      </div>

      {noted.length > 0 && (
        <section className="sec" aria-labelledby="noted">
          <div className="sec-h"><h2 id="noted">🇰🇷 บทความที่มีมุมมองจากบรรณาธิการ</h2></div>
          <div className="grid-4">{noted.map((p) => <Card key={p.slug} p={p} />)}</div>
        </section>
      )}
      <section className="sec" aria-labelledby="latest">
        <div className="sec-h"><h2 id="latest">⚡ บทความล่าสุด</h2><a href="/">ดูทั้งหมด ›</a></div>
        <div className="grid-4">{latest.map((p) => <Card key={p.slug} p={p} />)}</div>
        <p className="disc" style={{ marginTop: 12 }}>อัปเดตล่าสุด {all[0] ? thaiDate(all[0].createdAt) : ''}</p>
      </section>
    </>
  );
}
