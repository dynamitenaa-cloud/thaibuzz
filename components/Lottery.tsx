import { baht, nextDrawDate, PRIZE_LABEL, thaiLong, thaiShort, type Draw } from '@/lib/live';
import { LotteryCheck } from './LotteryCheck';

const Big = ({ label, prize, wide }: { label: string; prize?: { price: number; numbers: string[] }; wide?: boolean }) =>
  prize ? (
    <div className={`lot-big${wide ? ' wide' : ''}`}>
      <small>{label} · รางวัลละ {baht(prize.price)} บาท</small>
      <div className="lot-nums">{prize.numbers.map((n) => <b key={n}>{n}</b>)}</div>
    </div>
  ) : null;

export function DrawView({ draw, all, latest }: { draw: Draw; all: Draw[]; latest: boolean }) {
  const p = draw.prizes;
  const next = nextDrawDate(draw.date);
  return (
    <>
      <section className="lot-top" aria-label="รางวัลหลัก">
        <Big label={PRIZE_LABEL.first} prize={p.first} wide />
        <Big label={PRIZE_LABEL.last3f} prize={p.last3f} />
        <Big label={PRIZE_LABEL.last3b} prize={p.last3b} />
        <Big label={PRIZE_LABEL.last2} prize={p.last2} />
        <Big label={PRIZE_LABEL.near1} prize={p.near1} />
      </section>

      <LotteryCheck draw={draw} />

      {latest && (
        <p className="lot-next">งวดถัดไป: <b>{thaiLong(next)}</b> (ตามกำหนดปกติ หากสำนักงานสลากฯ เลื่อนวันออกรางวัล หน้านี้จะอัปเดตตามประกาศ)</p>
      )}

      <div className="prose">
        {(['second', 'third', 'fourth', 'fifth'] as const).filter((k) => p[k]).map((k) => (
          <section key={k}>
            <h2>{PRIZE_LABEL[k]} <small className="lot-sub">{p[k].numbers.length} รางวัล รางวัลละ {baht(p[k].price)} บาท</small></h2>
            <div className={`lot-grid${p[k].numbers.length > 20 ? ' dense' : ''}`}>{p[k].numbers.map((n) => <span key={n}>{n}</span>)}</div>
          </section>
        ))}

        <p className="disc">ข้อมูลจากสำนักงานสลากกินแบ่งรัฐบาล (GLO) อัปเดตอัตโนมัติ โปรดตรวจสอบกับ{draw.pdf ? <a href={draw.pdf} rel="nofollow noopener" target="_blank"> ใบตรวจรางวัลฉบับทางการ (PDF)</a> : 'ประกาศทางการ'}อีกครั้งก่อนขึ้นเงินรางวัล{draw.youtube ? <> · <a href={draw.youtube} rel="nofollow noopener" target="_blank">ชมการถ่ายทอดสดการออกรางวัล</a></> : null}</p>

        {all.length > 1 && (
          <section>
            <h2>ผลสลากงวดก่อนหน้า</h2>
            <ul className="lot-prev">
              {all.filter((d) => d.date !== draw.date).slice(0, 24).map((d) => (
                <li key={d.date}><a href={`/lottery/${d.date}/`}>งวด {thaiShort(d.date)}</a> <span>รางวัลที่ 1: <b>{d.prizes.first?.numbers[0]}</b> · เลขท้าย 2 ตัว: <b>{d.prizes.last2?.numbers[0]}</b></span></li>
              ))}
            </ul>
          </section>
        )}

        <section>
          <h2>สลากกินแบ่งรัฐบาลออกรางวัลวันไหน และมีรางวัลอะไรบ้าง</h2>
          <p>สลากกินแบ่งรัฐบาลออกรางวัลเดือนละ 2 ครั้ง คือวันที่ 1 และวันที่ 16 ของทุกเดือน (เลื่อนได้ในบางงวดตามประกาศของสำนักงานสลากฯ) เริ่มถ่ายทอดสดประมาณ 14.30 น. และทราบผลรางวัลที่ 1 ราว 16.00 น.</p>
          <p>รางวัลที่ 1 มี 1 รางวัล 6,000,000 บาท รางวัลข้างเคียงรางวัลที่ 1 มี 2 รางวัล รางวัลละ 100,000 บาท รางวัลที่ 2 มี 5 รางวัล รางวัลละ 200,000 บาท รางวัลที่ 3 มี 10 รางวัล รางวัลละ 80,000 บาท รางวัลที่ 4 มี 50 รางวัล รางวัลละ 40,000 บาท รางวัลที่ 5 มี 100 รางวัล รางวัลละ 20,000 บาท เลขหน้า 3 ตัวและเลขท้าย 3 ตัว รางวัลละ 4,000 บาท และเลขท้าย 2 ตัว รางวัลละ 2,000 บาท</p>
          <p>ผู้ถูกรางวัลต้องขึ้นเงินภายใน 2 ปีนับจากวันออกรางวัล โดยหักภาษีอากรแสตมป์ 0.5% ของเงินรางวัล (สลากกินแบ่งรัฐบาล) หรือ 1% (สลากการกุศล)</p>
        </section>
      </div>
    </>
  );
}
