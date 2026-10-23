import { homeFeed, type Post } from '@/lib/posts';
import { CATEGORIES, SITE } from '@/lib/site';
import { Card, Lead } from '@/components/PostCard';
import { Listing } from '@/components/Listing';
import { baht, getDraws, getGold, thaiShort } from '@/lib/live';

export default function Home() {
  // headline: 24시간 내 가장 뜨거운 글 3개 (없으면 최신). 나머지는 /page/n/ 과 같은 목록으로 이어짐
  const { top, rest } = homeFeed();
  if (!top.length)
    return <div className="empty"><b>🔥</b><p>กำลังรวบรวมประเด็นร้อน… กลับมาอีกครั้งเร็ว ๆ นี้</p></div>;
  const used = new Set(top.map((p) => p.slug));
  const draw = getDraws()[0];
  const gold = getGold().items.at(-1);

  const byCat = CATEGORIES.map((c) => ({ c, items: rest.filter((p) => p.category === c.name && !used.has(p.slug)).slice(0, 4) })).filter((x) => x.items.length >= 3);

  return (
    <>
      <h1 className="sr-only">{SITE.name} {SITE.tagline}</h1>
      <section className="hero" aria-label="ข่าวเด่น">
        <Lead p={top[0]} />
        {top.length > 1 && <div className="hero-side">{top.slice(1).map((p: Post) => <Card key={p.slug} p={p} priority />)}</div>}
      </section>

      {(draw || gold) && (
        <section className="live-strip" aria-label="ข้อมูลอัปเดต">
          {draw && <a href="/lottery/" className="live-card"><small>🎱 ผลสลากงวด {thaiShort(draw.date)}</small><b>{draw.prizes.first.numbers[0]}</b><span>รางวัลที่ 1 · เลขท้าย 2 ตัว {draw.prizes.last2?.numbers[0]} · ตรวจหวย ›</span></a>}
          {gold && <a href="/gold/" className="live-card"><small>🪙 ราคาทองวันนี้ {thaiShort(gold.date)}</small><b>{baht(gold.bar.sell)}</b><span>ทองแท่งขายออก (บาท) · รับซื้อ {baht(gold.bar.buy)} ›</span></a>}
        </section>
      )}

      <section className="sec" aria-labelledby="latest">
        <div className="sec-h"><h2 id="latest">⚡ ล่าสุด</h2></div>
        <Listing posts={rest} base="/" page={1} />
      </section>

      {byCat.map(({ c, items }) => (
        <section key={c.slug} className="sec" aria-labelledby={`c-${c.slug}`}>
          <div className="sec-h">
            <h2 id={`c-${c.slug}`}>{c.emoji} {c.name}</h2>
            <a href={`/category/${c.slug}/`}>ดูทั้งหมด ›</a>
          </div>
          <div className={items.length === 4 ? 'grid-4' : 'grid-auto'}>{items.map((p) => <Card key={p.slug} p={p} />)}</div>
        </section>
      ))}
    </>
  );
}
