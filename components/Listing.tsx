import Link from 'next/link';
import { getPosts, getTags, trending, tagUrl, type Post } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { Row, RankList } from './PostCard';
import Pager from './Pager';
import AdSlot from './AdSlot';

export function Sidebar({ exclude }: { exclude?: string } = {}) {
  const posts = getPosts().filter((p) => p.slug !== exclude);
  const tags = [...getTags().values()].sort((a, b) => b.count - a.count).slice(0, 16);
  return (
    <aside className="aside">
      <RankList title="มาแรงตอนนี้" posts={trending(posts, 10)} />
      <AdSlot client={SITE.adsense} side />
      {tags.length > 0 && (
        <section className="box" aria-label="แท็กยอดนิยม">
          <h2># แท็กยอดนิยม</h2>
          <div className="tagcloud">{tags.map((t) => <Link key={t.tag} href={tagUrl(t.tag)} className="chip">#{t.tag}</Link>)}</div>
        </section>
      )}
    </aside>
  );
}

export function Listing({ posts, base, page }: { posts: Post[]; base: string; page: number }) {
  const total = Math.max(1, Math.ceil(posts.length / SITE.perPage));
  const slice = posts.slice((page - 1) * SITE.perPage, page * SITE.perPage);
  return (
    <div className="cols">
      <div>
        <h2 className="sr-only">รายการบทความ</h2>
        {slice.length ? (
          slice.map((p, i) => (
            <div key={p.slug}>
              <Row p={p} />
              {i === 5 && <AdSlot client={SITE.adsense} />}
            </div>
          ))
        ) : (
          <div className="empty"><p>ยังไม่มีบทความในหน้านี้</p><Link className="btn" href="/">กลับหน้าแรก</Link></div>
        )}
        <Pager base={base} page={page} total={total} />
      </div>
      <Sidebar />
    </div>
  );
}

export const pageCount = (n: number) => Math.max(1, Math.ceil(n / SITE.perPage));
// static export ต้องมีอย่างน้อย 1 param เสมอ
export const pageParams = (n: number) => {
  const pages = Array.from({ length: pageCount(n) - 1 }, (_, i) => ({ n: String(i + 2) }));
  return pages.length ? pages : [{ n: '2' }];
};
