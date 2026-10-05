import { getPosts, getTags, MIN_TAG_POSTS, trending, tagUrl, type Post } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { Row, RankList } from './PostCard';
import Pager from './Pager';
import AdSlot from './AdSlot';

export function Sidebar({ exclude }: { exclude?: string } = {}) {
  const posts = getPosts().filter((p) => p.slug !== exclude);
  const tags = [...getTags().values()].filter((t) => t.count >= MIN_TAG_POSTS).sort((a, b) => b.count - a.count).slice(0, 16);
  return (
    <aside className="aside">
      <RankList title="มาแรงตอนนี้" posts={trending(posts, 10)} />
      <AdSlot side />
      {tags.length > 0 && (
        <section className="box" aria-label="แท็กยอดนิยม">
          <h2># คนดังและซีรีส์ที่ถูกพูดถึง</h2>
          <div className="tagcloud">{tags.map((t) => <a key={t.tag} href={tagUrl(t.tag)} className="chip">#{t.tag}</a>)}</div>
          <a href="/hub/" style={{ display: 'block', marginTop: 12, fontSize: '.9rem', color: 'var(--brand-ink)' }}>ดูทั้งหมด ›</a>
        </section>
      )}
    </aside>
  );
}

// all: 페이지 나누지 않고 전부 표시 (태그 페이지처럼 /page/n/ 경로가 없는 목록)
export function Listing({ posts, base, page, all = false }: { posts: Post[]; base: string; page: number; all?: boolean }) {
  const total = all ? 1 : Math.max(1, Math.ceil(posts.length / SITE.perPage));
  const slice = all ? posts : posts.slice((page - 1) * SITE.perPage, page * SITE.perPage);
  return (
    <div className="cols">
      <div>
        <h2 className="sr-only">รายการบทความ</h2>
        {slice.length ? (
          slice.map((p, i) => (
            <div key={p.slug}>
              <Row p={p} />
              {i === 5 && <AdSlot />}
            </div>
          ))
        ) : (
          <div className="empty"><p>ยังไม่มีบทความในหน้านี้</p><a className="btn" href="/">กลับหน้าแรก</a></div>
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
