import fs from 'node:fs';
import path from 'node:path';
import { SITE } from '@/lib/site';

// 기사 하단 "핀터레스트에 저장" 블록. 세로형 핀 이미지(public/pins/<slug>.jpg, scripts/make-pins.mjs 가 최근 글만 생성)가 있을 때만 보임.
// 핀터레스트의 "URL에서 저장" 도구는 세로형(2:3) 이미지만 인식하므로 이 이미지가 페이지에 있어야 핀이 만들어짐. 독자용 저장 버튼도 겸함
export default function PinSave({ slug, title, url }: { slug: string; title: string; url: string }) {
  if (!fs.existsSync(path.join(process.cwd(), 'public', 'pins', `${slug}.jpg`))) return null;
  const media = `${SITE.url}/pins/${slug}.jpg`;
  const href = `https://www.pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(media)}&description=${encodeURIComponent(title)}`;
  return (
    <aside className="pin-save" aria-label="บันทึกลง Pinterest">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`/pins/${slug}.jpg`} width={200} height={300} loading="lazy" decoding="async" alt={`ภาพสรุปข่าว ${title}`} />
      <div>
        <b>เก็บข่าวนี้ไว้อ่านทีหลัง</b>
        <p>บันทึกภาพสรุปลง Pinterest ของคุณ</p>
        <a href={href} target="_blank" rel="noopener noreferrer nofollow">📌 บันทึกลง Pinterest</a>
      </div>
    </aside>
  );
}
