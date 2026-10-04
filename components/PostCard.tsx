import Link from 'next/link';
import { catOf, displayImg, postUrl, thaiDate, type Post } from '@/lib/posts';
import TimeAgo from './TimeAgo';
import ThaiText from './ThaiText';

const isHot = (p: Post) => p.traffic >= 20000;

function Meta({ p, cat = true }: { p: Post; cat?: boolean }) {
  const c = catOf(p);
  return (
    <div className="meta">
      {cat && <span className="cat" style={{ '--c': c.color } as React.CSSProperties}>{c.name}</span>}
      {cat && <span className="dot" />}
      <TimeAgo iso={p.createdAt} fallback={thaiDate(p.createdAt)} />
    </div>
  );
}

export function Card({ p, priority = false }: { p: Post; priority?: boolean }) {
  return (
    <article className="card">
      <div className="media">
        <img src={p.thumbSm} alt={p.imageAlt || p.title} width={640} height={336} loading={priority ? 'eager' : 'lazy'} decoding="async" />
        {isHot(p) && <span className="badge-hot">🔥 มาแรง</span>}
      </div>
      <Meta p={p} />
      <h3 className="clamp-3"><Link href={postUrl(p)}><ThaiText>{p.title}</ThaiText></Link></h3>
    </article>
  );
}

export function Lead({ p }: { p: Post }) {
  const c = catOf(p);
  // ภาพปกที่มีตัวอักษรอยู่แล้ว → ไม่วางพาดหัวทับ ใช้เลย์เอาต์แบบภาพบน-ข้อความล่าง
  if (!p.thumbClean)
    return (
      <article className="card lead-stack">
        <div className="media">
          <img src={displayImg(p)} srcSet={`${p.thumbSm} 640w, ${displayImg(p)} 1200w`} sizes="(max-width: 860px) 100vw, 760px" alt={p.imageAlt || p.title} width={1200} height={630} fetchPriority="high" />
          {isHot(p) && <span className="badge-hot">🔥 มาแรง</span>}
        </div>
        <Meta p={p} />
        <h2><Link href={postUrl(p)}><ThaiText>{p.title}</ThaiText></Link></h2>
        <p className="clamp-2">{p.excerpt}</p>
      </article>
    );
  return (
    <Link href={postUrl(p)} className="lead">
      <img src={p.thumbClean} srcSet={`${p.thumbSm} 640w, ${p.thumbClean} 1200w`} sizes="(max-width: 860px) 100vw, 760px" alt={p.imageAlt || p.title} width={1200} height={630} fetchPriority="high" />
      <div className="lead-body">
        <span className="cat" style={{ '--c': c.color } as React.CSSProperties}>{c.emoji} {c.name}</span>
        <h2><ThaiText>{p.title}</ThaiText></h2>
        <p className="clamp-2">{p.excerpt}</p>
        <div className="meta"><TimeAgo iso={p.createdAt} fallback={thaiDate(p.createdAt)} /></div>
      </div>
    </Link>
  );
}

export function Row({ p }: { p: Post }) {
  return (
    <article className="row">
      <div className="media">
        <img src={p.thumbSm} alt={p.imageAlt || p.title} width={640} height={336} loading="lazy" decoding="async" />
      </div>
      <div>
        <Meta p={p} />
        <h3 className="clamp-3"><Link href={postUrl(p)}><ThaiText>{p.title}</ThaiText></Link></h3>
        <p className="clamp-2">{p.excerpt}</p>
      </div>
    </article>
  );
}

export function RankList({ posts, title }: { posts: Post[]; title: string }) {
  if (!posts.length) return null;
  return (
    <section className="box" aria-label={title}>
      <h2>🔥 {title}</h2>
      <ol className="rank">
        {posts.map((p) => (
          <li key={p.slug}>
            <div>
              <Link href={postUrl(p)} className="clamp-3"><ThaiText>{p.title}</ThaiText></Link>
              <Meta p={p} cat={false} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
