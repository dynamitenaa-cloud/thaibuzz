'use client';
import { useState } from 'react';
import type { Draw } from '@/lib/live';

// 번호 입력 → 당첨 여부 즉시 확인 (서버 없이 브라우저에서만 계산)
const LABEL: Record<string, string> = {
  first: 'รางวัลที่ 1', near1: 'รางวัลข้างเคียงรางวัลที่ 1', second: 'รางวัลที่ 2', third: 'รางวัลที่ 3', fourth: 'รางวัลที่ 4', fifth: 'รางวัลที่ 5',
  last3f: 'เลขหน้า 3 ตัว', last3b: 'เลขท้าย 3 ตัว', last2: 'เลขท้าย 2 ตัว',
};

export function check(draw: Draw, n: string) {
  const hits: { label: string; price: number }[] = [];
  const p = draw.prizes;
  for (const k of ['first', 'near1', 'second', 'third', 'fourth', 'fifth']) if (p[k]?.numbers.includes(n)) hits.push({ label: LABEL[k], price: p[k].price });
  if (p.last3f?.numbers.includes(n.slice(0, 3))) hits.push({ label: LABEL.last3f, price: p.last3f.price });
  if (p.last3b?.numbers.includes(n.slice(3))) hits.push({ label: LABEL.last3b, price: p.last3b.price });
  if (p.last2?.numbers.includes(n.slice(4))) hits.push({ label: LABEL.last2, price: p.last2.price });
  return hits;
}

export function LotteryCheck({ draw }: { draw: Draw }) {
  const [v, setV] = useState('');
  const n = v.replace(/\D/g, '').slice(0, 6);
  const ready = n.length === 6;
  const hits = ready ? check(draw, n) : [];
  const total = hits.reduce((s, h) => s + h.price, 0);
  return (
    <section className="lot-check" aria-label="ตรวจหวย">
      <label htmlFor="lot-in"><b>ตรวจหวยงวดนี้</b> พิมพ์เลข 6 หลักบนสลากของคุณ</label>
      <input id="lot-in" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="เช่น 123456" value={n} onChange={(e) => setV(e.target.value)} autoComplete="off" />
      <div className="lot-result" aria-live="polite">
        {ready && hits.length === 0 && <p className="miss">เลข {n} ไม่ถูกรางวัลในงวดนี้ — งวดหน้าลุ้นใหม่</p>}
        {ready && hits.length > 0 && (
          <div className="hit">
            <p>🎉 เลข {n} ถูกรางวัล!</p>
            <ul>{hits.map((h) => <li key={h.label}>{h.label} — {h.price.toLocaleString('th-TH')} บาท</li>)}</ul>
            {hits.length > 1 && <p>รวม {total.toLocaleString('th-TH')} บาท</p>}
          </div>
        )}
      </div>
    </section>
  );
}
