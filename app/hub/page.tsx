import type { Metadata } from 'next';
import { HUB_LABEL, hubs, MIN_HUB_INDEX, type HubKind } from '@/lib/posts';
import { og } from '@/lib/og';

// 인물·작품 허브 목록: 모든 허브로 가는 내부 링크 (검색엔진이 허브를 발견하고, 독자가 관심 대상을 찾게)
const title = 'รวมคนดัง ซีรีส์ และประเด็นที่ถูกพูดถึง';
export const metadata: Metadata = {
  title,
  description: 'รวมข่าวล่าสุดแยกตามคนดัง ซีรีส์ ผลงาน วง และประเด็นร้อน อัปเดตอัตโนมัติจากข่าวทั้งหมดบน ThaiBuzz',
  alternates: { canonical: '/hub/' },
  openGraph: og('/hub/', title),
};

const ORDER: HubKind[] = ['person', 'work', 'group', 'other'];

export default function Page() {
  const all = hubs();
  const groups = ORDER.map((k) => ({ k, items: all.filter((h) => h.kind === k) })).filter((g) => g.items.length);
  return (
    <div style={{ maxWidth: 960 }}>
      <div className="ph">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li>รวมคนดังและซีรีส์</li></ol></nav>
        <h1>{title}</h1>
        <p>{all.length} หัวข้อ · หัวข้อที่มีข่าว {MIN_HUB_INDEX} เรื่องขึ้นไปจะมีหน้าสรุปไทม์ไลน์ครบ</p>
      </div>
      {!all.length && <div className="empty"><p>กำลังรวบรวม… กลับมาอีกครั้งเร็ว ๆ นี้</p></div>}
      {groups.map(({ k, items }) => (
        <section key={k} className="sec" aria-labelledby={`h-${k}`}>
          <div className="sec-h"><h2 id={`h-${k}`}>{HUB_LABEL[k]}</h2></div>
          <div className="hub-grid">
            {items.map((h) => (
              <a key={h.slug} href={`/tag/${h.slug}/`} className="hub-card">
                <b>{h.name}</b>
                <small>{h.count} ข่าว</small>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
