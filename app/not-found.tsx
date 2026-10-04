import Link from 'next/link';
import { getPosts } from '@/lib/posts';
import { Card } from '@/components/PostCard';

export default function NotFound() {
  const posts = getPosts().slice(0, 4);
  return (
    <>
      <div className="empty">
        <b>404</b>
        <p>ไม่พบหน้าที่คุณกำลังหา ข่าวนี้อาจถูกย้ายหรือลบไปแล้ว</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <Link className="btn" href="/">กลับหน้าแรก</Link>
          <Link className="btn" href="/search/" style={{ background: 'var(--fg)', color: 'var(--bg)' }}>ค้นหาข่าว</Link>
        </div>
      </div>
      {posts.length > 0 && (
        <section className="sec">
          <div className="sec-h"><h2>⚡ ข่าวล่าสุด</h2></div>
          <div className="grid-4">{posts.map((p) => <Card key={p.slug} p={p} />)}</div>
        </section>
      )}
    </>
  );
}
