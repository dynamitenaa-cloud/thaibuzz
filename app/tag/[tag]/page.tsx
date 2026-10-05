import type { Metadata } from 'next';
import { catOf, getTags, HUB_LABEL, hubKind, hubPosts, MIN_HUB_INDEX, MIN_TAG_POSTS, postUrl, tagSlug, tagUrl, thaiDate, type Post } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { Listing } from '@/components/Listing';
import JsonLd from '@/components/JsonLd';
import { og } from '@/lib/og';

// 인물·작품 허브 페이지 (/tag/<slug>/)
// 내용은 전부 "우리 기사에서" 만든다 (소개·타임라인·FAQ) → 실존 인물 정보를 지어내지 않음
type P = { params: Promise<{ tag: string }> };

const linkable = () => [...getTags()].filter(([, t]) => t.count >= MIN_TAG_POSTS);
const day = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' });

export const dynamicParams = false;
export const generateStaticParams = () => {
  const keys = linkable().map(([s]) => s);
  return keys.length ? keys.map((tag) => ({ tag })) : [{ tag: '_' }];
};

function hubData(slug: string) {
  const t = getTags().get(slug);
  if (!t || t.count < MIN_TAG_POSTS) return null;
  const posts = hubPosts(slug);
  const kind = hubKind(t.tag);
  const first = posts[posts.length - 1]?.createdAt, last = posts[0]?.createdAt;
  const cats = [...new Set(posts.map((p) => catOf(p).name))];
  // 함께 자주 등장한 다른 대상 (내부 링크 → 크롤링/체류 개선)
  const co = new Map<string, number>();
  for (const p of posts) for (const x of p.tags) if (tagSlug(x) !== slug) co.set(x, (co.get(x) ?? 0) + 1);
  const related = [...co].filter(([x]) => (getTags().get(tagSlug(x))?.count ?? 0) >= MIN_TAG_POSTS).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([x]) => x);
  // 우리 기사들의 FAQ 중 이 대상에 관한 것 (중복 질문 제거)
  const name = t.tag.toLowerCase();
  const seen = new Set<string>();
  const faq = posts.flatMap((p) => p.faq.map((f) => ({ ...f, p })))
    .filter((f) => (f.q + f.a).toLowerCase().includes(name) && !seen.has(f.q) && seen.add(f.q))
    .slice(0, 6);
  return { t, posts, kind, first, last, cats, related, faq };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { tag } = await params;
  const d = hubData(tag);
  if (!d) return { robots: { index: false } };
  const path = `/tag/${tag}/`;
  const title = `${d.t.tag} ข่าวล่าสุด: รวมไทม์ไลน์และประเด็นที่ควรรู้`;
  const description = `รวมข่าว ${d.t.tag} ล่าสุด ${d.posts.length} เรื่อง ${d.last ? `อัปเดต ${day(d.last)}` : ''} สรุปไทม์ไลน์และคำถามที่หลายคนสงสัย พร้อมแหล่งอ้างอิง`;
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: og(path, title, { description, ...(d.posts[0]?.thumb ? { images: [{ url: d.posts[0].thumb, width: 1200, height: 630 }] } : {}) }),
    // 글이 MIN_HUB_INDEX 개 미만이면 아직 빈약 → 색인 제외 (링크는 따라가게)
    robots: d.posts.length >= MIN_HUB_INDEX ? undefined : { index: false, follow: true },
  };
}

export default async function Page({ params }: P) {
  const { tag } = await params;
  const d = hubData(tag);
  if (!d) return <div className="empty"><p>ไม่พบหน้านี้</p></div>;
  const latest: Post = d.posts[0];
  const url = `${SITE.url}/tag/${tag}/`;
  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'CollectionPage', '@id': url, url, name: `${d.t.tag} ข่าวล่าสุด`, inLanguage: 'th',
              about: { '@type': d.kind === 'person' ? 'Person' : d.kind === 'work' ? 'CreativeWork' : d.kind === 'group' ? 'Organization' : 'Thing', name: d.t.tag },
              mainEntity: { '@type': 'ItemList', itemListElement: d.posts.slice(0, 20).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE.url}${postUrl(p)}`, name: p.title })) },
            },
            { '@type': 'BreadcrumbList', itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url },
              { '@type': 'ListItem', position: 2, name: 'รวมคนดังและซีรีส์', item: `${SITE.url}/hub/` },
              { '@type': 'ListItem', position: 3, name: d.t.tag, item: url },
            ] },
          ],
        }}
      />
      <div className="ph">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li><a href="/hub/">รวมคนดังและซีรีส์</a></li><li>{d.t.tag}</li></ol></nav>
        <span className="cat">{HUB_LABEL[d.kind]}</span>
        <h1>{d.t.tag} ข่าวล่าสุด</h1>
        <p>
          รวมข่าวและประเด็นเกี่ยวกับ <b>{d.t.tag}</b> จาก {SITE.name} ทั้งหมด {d.posts.length} เรื่อง
          {d.first && d.last ? ` ตั้งแต่ ${day(d.first)} ถึง ${day(d.last)}` : ''} ในหมวด {d.cats.join(', ')}
        </p>
      </div>

      <div className="hub-top">
        <section className="tldr" aria-label="ล่าสุด">
          <h2>⚡ ล่าสุดเกี่ยวกับ {d.t.tag}</h2>
          <p style={{ margin: '0 0 6px', fontWeight: 600 }}><a href={postUrl(latest)}>{latest.title}</a></p>
          <ul>{latest.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
        </section>

        <section className="hub-sec" aria-labelledby="tl">
          <h2 id="tl">ไทม์ไลน์ข่าว {d.t.tag}</h2>
          <ol className="timeline">
            {d.posts.slice(0, 12).map((p) => (
              <li key={p.slug}><b>{thaiDate(p.createdAt)}</b><a href={postUrl(p)}>{p.title}</a></li>
            ))}
          </ol>
        </section>

        {d.faq.length > 0 && (
          <section className="hub-sec faq" aria-labelledby="hfaq">
            <h2 id="hfaq">คำถามที่หลายคนสงสัยเกี่ยวกับ {d.t.tag}</h2>
            {d.faq.map((f, i) => (
              <details key={i} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a} <a href={postUrl(f.p)} style={{ textDecoration: 'underline' }}>อ่านต่อ</a></p>
              </details>
            ))}
          </section>
        )}

        {d.related.length > 0 && (
          <section className="hub-sec" aria-labelledby="rel">
            <h2 id="rel">ที่เกี่ยวข้องกับ {d.t.tag}</h2>
            <div className="tagcloud">{d.related.map((x) => <a key={x} href={tagUrl(x)} className="chip">#{x}</a>)}</div>
          </section>
        )}
      </div>

      <h2 className="hub-list-h">ข่าวทั้งหมดเกี่ยวกับ {d.t.tag}</h2>
      {/* 허브는 /page/n/ 경로가 없으므로 전부 표시 */}
      <Listing posts={d.posts} base={`/tag/${tag}/`} page={1} all />
    </>
  );
}
