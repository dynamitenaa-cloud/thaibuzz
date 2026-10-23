import type { Metadata } from 'next';
import { baht, getGold, thaiLong, thaiShort, type GoldRow } from '@/lib/live';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import JsonLd from '@/components/JsonLd';

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  const { items } = getGold();
  const t = items.at(-1);
  const title = t ? `ราคาทองวันนี้ ${thaiShort(t.date)} ทองแท่งขายออก ${baht(t.bar.sell)} บาท` : 'ราคาทองวันนี้';
  const description = t
    ? `ราคาทองคำวันนี้ ${thaiLong(t.date)} ตามประกาศสมาคมค้าทองคำ ทองคำแท่ง 96.5% รับซื้อ ${baht(t.bar.buy)} ขายออก ${baht(t.bar.sell)} บาท ทองรูปพรรณ รับซื้อ ${baht(t.orn.buy)} ขายออก ${baht(t.orn.sell)} บาท อัปเดตล่าสุด ${t.time} น.`
    : 'ราคาทองคำแท่งและทองรูปพรรณวันนี้ ตามประกาศสมาคมค้าทองคำ อัปเดตทุกชั่วโมง';
  return { title, description, alternates: { canonical: '/gold/' }, openGraph: og('/gold/', title, { description }), robots: t ? undefined : { index: false } };
}

// 30일 추이 (정적 SVG). 데이터가 2개 미만이면 표시 안 함
function Chart({ rows }: { rows: GoldRow[] }) {
  if (rows.length < 2) return null;
  const W = 720, H = 220, PL = 56, PR = 12, PT = 14, PB = 28;
  const ys = rows.map((r) => r.bar.sell);
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const pad = Math.max(50, (hi - lo) * 0.15);
  const y0 = lo - pad, y1 = hi + pad;
  const x = (i: number) => PL + (i * (W - PL - PR)) / (rows.length - 1);
  const y = (v: number) => PT + ((y1 - v) * (H - PT - PB)) / (y1 - y0);
  const d = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.bar.sell).toFixed(1)}`).join(' ');
  const ticks = [y0, (y0 + y1) / 2, y1].map((v) => Math.round(v));
  const last = rows.at(-1)!;
  return (
    <figure className="gold-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`ราคาทองคำแท่งขายออกย้อนหลัง ${rows.length} วัน`}>
        {ticks.map((v) => <g key={v}><line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className="grid" /><text x={PL - 6} y={y(v) + 4} textAnchor="end" className="tick">{baht(v)}</text></g>)}
        <path d={d} className="line" />
        <circle cx={x(rows.length - 1)} cy={y(last.bar.sell)} r={4} className="dot" />
        <text x={x(0)} y={H - 8} className="tick">{thaiShort(rows[0].date)}</text>
        <text x={x(rows.length - 1)} y={H - 8} textAnchor="end" className="tick">{thaiShort(last.date)}</text>
      </svg>
      <figcaption>ราคาทองคำแท่ง 96.5% (ขายออก) บาทต่อบาททองคำ ย้อนหลัง {rows.length} วัน</figcaption>
    </figure>
  );
}

const Delta = ({ now, prev }: { now: number; prev?: number }) => {
  if (prev === undefined) return null;
  const d = now - prev;
  if (!d) return <small className="flat">ไม่เปลี่ยนแปลงจากวันก่อน</small>;
  return <small className={d > 0 ? 'up' : 'down'}>{d > 0 ? '▲' : '▼'} {baht(Math.abs(d))} บาท จากวันก่อน</small>;
};

export default function Page() {
  const { items } = getGold();
  const t = items.at(-1);
  if (!t) return <div className="empty"><b>🪙</b><p>กำลังรวบรวมราคาทอง… กลับมาอีกครั้งเร็ว ๆ นี้</p></div>;
  const prev = items.at(-2);
  const last30 = items.slice(-30);
  const title = `ราคาทองวันนี้ ${thaiLong(t.date)}`;
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@graph': [
        { '@type': 'WebPage', name: title, url: `${SITE.url}/gold/`, dateModified: `${t.date}T${t.time || '00:00'}:00+07:00`, isPartOf: { '@id': `${SITE.url}/#web` }, about: 'ราคาทองคำ' },
        { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url }, { '@type': 'ListItem', position: 2, name: 'ราคาทอง', item: `${SITE.url}/gold/` }] },
      ] }} />
      <div className="doc gold">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li>ราคาทอง</li></ol></nav>
        <h1>{title}</h1>
        <p className="lede">ราคาทองคำตามประกาศสมาคมค้าทองคำ อัปเดตล่าสุด {t.time ? `${t.time} น.` : ''}{t.round ? ` (ประกาศครั้งที่ ${t.round} ของวัน)` : ''} หน่วย: บาทต่อบาททองคำ</p>

        <section className="gold-cards" aria-label="ราคาวันนี้">
          <div className="gold-card">
            <small>ทองคำแท่ง 96.5%</small>
            <div className="gold-row"><span>รับซื้อ</span><b>{baht(t.bar.buy)}</b></div>
            <div className="gold-row"><span>ขายออก</span><b>{baht(t.bar.sell)}</b></div>
            <Delta now={t.bar.sell} prev={prev?.bar.sell} />
          </div>
          <div className="gold-card">
            <small>ทองรูปพรรณ 96.5%</small>
            <div className="gold-row"><span>รับซื้อ</span><b>{baht(t.orn.buy)}</b></div>
            <div className="gold-row"><span>ขายออก</span><b>{baht(t.orn.sell)}</b></div>
            <Delta now={t.orn.sell} prev={prev?.orn.sell} />
          </div>
        </section>

        <Chart rows={last30} />

        <div className="prose">
          {items.length > 1 && (
            <section>
              <h2>ราคาทองย้อนหลัง</h2>
              <table className="gold-table">
                <thead><tr><th>วันที่</th><th>แท่ง รับซื้อ</th><th>แท่ง ขายออก</th><th>รูปพรรณ รับซื้อ</th><th>รูปพรรณ ขายออก</th></tr></thead>
                <tbody>{[...last30].reverse().map((r) => <tr key={r.date}><td>{thaiShort(r.date)}</td><td>{baht(r.bar.buy)}</td><td>{baht(r.bar.sell)}</td><td>{baht(r.orn.buy)}</td><td>{baht(r.orn.sell)}</td></tr>)}</tbody>
              </table>
            </section>
          )}
          <section>
            <h2>ราคาทองวันนี้ดูอย่างไร</h2>
            <p>ราคาที่แสดงเป็นราคาประกาศของสมาคมค้าทองคำ ซึ่งร้านทองทั่วประเทศใช้อ้างอิง "ขายออก" คือราคาที่ร้านขายให้ลูกค้า ส่วน "รับซื้อ" คือราคาที่ร้านรับซื้อคืน ราคาทองรูปพรรณที่หน้าร้านจะบวกค่ากำเหน็จเพิ่มจากราคานี้ตามแบบของเครื่องประดับ</p>
            <p>1 บาททองคำ หนัก 15.244 กรัม (ทองคำแท่ง) หรือ 15.16 กรัม (ทองรูปพรรณ) ทองความบริสุทธิ์ 96.5% คือมาตรฐานทองไทย สมาคมฯ ประกาศราคาได้หลายครั้งต่อวันตามความเคลื่อนไหวของราคาทองโลกและค่าเงินบาท หน้านี้อัปเดตอัตโนมัติทุกชั่วโมง</p>
          </section>
          <p className="disc">ข้อมูล: สมาคมค้าทองคำ (Gold Traders Association) · ใช้เพื่อการอ้างอิง ราคาซื้อขายจริงขึ้นกับร้านค้าและเวลา</p>
        </div>
      </div>
    </>
  );
}
