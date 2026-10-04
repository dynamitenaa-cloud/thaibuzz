import Link from 'next/link';
import { getPosts, trending, type Post } from '@/lib/posts';
import { CATEGORIES } from '@/lib/site';
import { Card, Lead } from '@/components/PostCard';
import { Listing } from '@/components/Listing';

export default function Home() {
  const posts = getPosts();
  if (!posts.length)
    return <div className="empty"><b>🔥</b><p>กำลังรวบรวมประเด็นร้อน… กลับมาอีกครั้งเร็ว ๆ นี้</p></div>;

  // headline: บทความมาแรงที่สุดใน 24 ชม. (ถ้าไม่มี ใช้ล่าสุด)
  const fresh = posts.filter((p) => Date.now() - Date.parse(p.createdAt) < 864e5);
  const top = trending(fresh.length >= 3 ? fresh : posts, 3);
  const used = new Set(top.map((p) => p.slug));

  const byCat = CATEGORIES.map((c) => ({ c, items: posts.filter((p) => p.category === c.name && !used.has(p.slug)).slice(0, 4) })).filter((x) => x.items.length >= 3);

  return (
    <>
      <h1 className="sr-only">ThaiBuzz ข่าวฮิต ดราม่า เทรนด์ล่าสุด</h1>
      <section className="hero" aria-label="ข่าวเด่น">
        <Lead p={top[0]} />
        {top.length > 1 && <div className="hero-side">{top.slice(1).map((p: Post) => <Card key={p.slug} p={p} priority />)}</div>}
      </section>

      <section className="sec" aria-labelledby="latest">
        <div className="sec-h"><h2 id="latest">⚡ ล่าสุด</h2></div>
        <Listing posts={posts.filter((p) => !used.has(p.slug))} base="/" page={1} />
      </section>

      {byCat.map(({ c, items }) => (
        <section key={c.slug} className="sec" aria-labelledby={`c-${c.slug}`}>
          <div className="sec-h">
            <h2 id={`c-${c.slug}`}>{c.emoji} {c.name}</h2>
            <Link href={`/category/${c.slug}/`}>ดูทั้งหมด ›</Link>
          </div>
          <div className={items.length === 4 ? 'grid-4' : 'grid-auto'}>{items.map((p) => <Card key={p.slug} p={p} />)}</div>
        </section>
      ))}
    </>
  );
}
