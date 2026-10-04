import { Fragment } from 'react';

// ภาษาไทยไม่มีช่องว่างระหว่างคำ — บางเบราว์เซอร์ตัดบรรทัดกลางคำ (เช่น "เท|รนด์")
// แทรก <wbr> ตามขอบเขตคำจาก Intl.Segmenter ตอน build (ไม่กระทบข้อความที่คัดลอก/SEO)
const seg = new Intl.Segmenter('th', { granularity: 'word' });

export default function ThaiText({ children }: { children: string }) {
  const parts = [...seg.segment(children)].map((s) => s.segment);
  return (
    <>
      {parts.map((p, i) => (
        <Fragment key={i}>
          {i > 0 && <wbr />}
          {p}
        </Fragment>
      ))}
    </>
  );
}
