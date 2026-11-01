import type { Metadata } from 'next';
import { og } from '@/lib/og';
import { SITE } from '@/lib/site';
import { EDITOR, editorUrl } from '@/lib/editor';
import { getQAs } from '@/lib/qa';
import { thaiDate } from '@/lib/posts';
import { AskEditor } from '@/components/AskEditor';
import JsonLd from '@/components/JsonLd';

const title = 'ถามบรรณาธิการชาวเกาหลี — ตอบเรื่องเกาหลีโดยคนเกาหลีจริง ๆ';
const desc = 'อยากรู้เรื่องดารา ซีรีส์ วัฒนธรรม ภาษา หรือชีวิตในเกาหลี? ส่งคำถามมาให้ ชิน ยุน-มิน บรรณาธิการชาวเกาหลีของ ThaiBuzz ตอบ';
export const metadata: Metadata = { title, description: desc, alternates: { canonical: '/ask/' }, openGraph: og('/ask/', title) };

export default function Page() {
  const qas = getQAs();
  return (
    <div className="doc">
      {qas.length > 0 && (
        <JsonLd data={{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: qas.slice(0, 30).map((x) => ({ '@type': 'Question', name: x.q, acceptedAnswer: { '@type': 'Answer', text: x.a, author: { '@type': 'Person', name: EDITOR.name } } })) }} />
      )}
      <h1>🇰🇷 ถามบรรณาธิการชาวเกาหลี</h1>
      <p>{desc} คำถามที่น่าสนใจจะถูกเลือกมาตอบที่หน้านี้ (ไม่ได้ตอบทุกข้อ และขอสงวนสิทธิ์ไม่ตอบเรื่องส่วนตัวหรือประเด็นอ่อนไหว)</p>
      <AskEditor />
      <h2>คำถามที่ตอบแล้ว</h2>
      {qas.length === 0 && <p>ยังไม่มีคำถามที่ตอบ — เป็นคนแรกที่ถามเลย!</p>}
      <div className="qa-list">
        {qas.map((x) => (
          <article className="qa-item" key={x.id} id={x.id}>
            <h2>{x.q}</h2>
            <p>{x.a}</p>
            <div className="by"><img src={EDITOR.photo} alt="" width={28} height={28} loading="lazy" /><a href={editorUrl()}>{EDITOR.name}</a><small>· {thaiDate(x.at)}</small></div>
          </article>
        ))}
      </div>
      <p><small>{SITE.name} — คำตอบเป็นความเห็นส่วนตัวของบรรณาธิการ ไม่ใช่ข้อมูลทางการ</small></p>
    </div>
  );
}
