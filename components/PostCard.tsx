import { catOf, displayImg, hasImg, postUrl, thaiDate, type Post } from '@/lib/posts';
import TimeAgo from './TimeAgo';

// 글 링크는 next/link 대신 일반 <a>: 전체 페이지 로드 → AdSense/GA 페이지뷰가 정확히 집계되고,
// 정적 export 에서 글마다 생기던 RSC 페이로드 파일(6개)이 필요 없어 Cloudflare 파일 한도를 아낀다.
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

// 이미지가 없는 글(오래된 글)은 카테고리 색 플레이스홀더
export function Thumb({ p, lazy = true }: { p: Post; lazy?: boolean }) {
  if (!hasImg(p)) {
    const c = catOf(p);
    return <div className="thumb-ph" style={{ '--c': c.color } as React.CSSProperties} role="img" aria-label={p.imageAlt || p.title}>{c.emoji}</div>;
  }
  return <img src={p.thumbSm} alt={p.imageAlt || p.title} width={640} height={336} loading={lazy ? 'lazy' : 'eager'} decoding="async" />;
}

export function Card({ p, priority = false }: { p: Post; priority?: boolean }) {
  return (
    <article className="card">
      <div className="media">
        <Thumb p={p} lazy={!priority} />
        {isHot(p) && <span className="badge-hot">🔥 มาแรง</span>}
      </div>
      <Meta p={p} />
      <h3 className="clamp-3"><a href={postUrl(p)}>{p.title}</a></h3>
    </article>
  );
}

export function Lead({ p }: { p: Post }) {
  const c = catOf(p);
  // 사진이 없거나(그라데이션/오래된 글) 이미 글자가 박힌 커버 → 제목을 위에 덧씌우지 않는 세로 레이아웃
  if (!p.thumbClean)
    return (
      <article className="card lead-stack">
        <div className="media">
          {hasImg(p) ? (
            <img src={displayImg(p)} srcSet={`${p.thumbSm} 640w, ${displayImg(p)} 1200w`} sizes="(max-width: 860px) 100vw, 760px" alt={p.imageAlt || p.title} width={1200} height={630} fetchPriority="high" />
          ) : <Thumb p={p} />}
          {isHot(p) && <span className="badge-hot">🔥 มาแรง</span>}
        </div>
        <Meta p={p} />
        <h2><a href={postUrl(p)}>{p.title}</a></h2>
        <p className="clamp-2">{p.excerpt}</p>
      </article>
    );
  return (
    <a href={postUrl(p)} className="lead">
      <img src={p.thumbClean} srcSet={`${p.thumbSm} 640w, ${p.thumbClean} 1200w`} sizes="(max-width: 860px) 100vw, 760px" alt={p.imageAlt || p.title} width={1200} height={630} fetchPriority="high" />
      <div className="lead-body">
        <span className="cat" style={{ '--c': c.color } as React.CSSProperties}>{c.emoji} {c.name}</span>
        <h2>{p.title}</h2>
        <p className="clamp-2">{p.excerpt}</p>
        <div className="meta"><TimeAgo iso={p.createdAt} fallback={thaiDate(p.createdAt)} /></div>
      </div>
    </a>
  );
}

export function Row({ p }: { p: Post }) {
  return (
    <article className="row">
      <div className="media"><Thumb p={p} /></div>
      <div>
        <Meta p={p} />
        <h3 className="clamp-3"><a href={postUrl(p)}>{p.title}</a></h3>
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
              <a href={postUrl(p)} className="clamp-3">{p.title}</a>
              <Meta p={p} cat={false} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
