import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catOf, displayImg, getPost, hasImg, ogImage, getPosts, postUrl, readingMinutes, related, tagHasPage, tagUrl, thaiDate, wordCount, type Post } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { Card } from '@/components/PostCard';
import { Sidebar } from '@/components/Listing';
import { ArticleChrome, Share } from '@/components/Share';
import AdSlot from '@/components/AdSlot';
import JsonLd from '@/components/JsonLd';
import { ClockIcon } from '@/components/Icons';

function ReadMore({ p }: { p: Post }) {
  return (
    <aside className="readmore" aria-label="อ่านเพิ่มเติม">
      {hasImg(p) && <img src={p.thumbSm} alt="" width={120} height={63} loading="lazy" />}
      <div><small>อ่านเพิ่มเติม</small><a href={postUrl(p)} className="clamp-2">{p.title}</a></div>
    </aside>
  );
}

type P = { params: Promise<{ slug: string }> };

export const dynamicParams = false;
export const generateStaticParams = () => {
  const s = getPosts().map((p) => ({ slug: p.slug }));
  return s.length ? s : [{ slug: '_' }];
};

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const p = getPost((await params).slug);
  if (!p) return { robots: { index: false } };
  const url = postUrl(p);
  return {
    title: p.title,
    description: p.excerpt,
    keywords: [p.keyword, ...p.tags],
    alternates: { canonical: url },
    openGraph: {
      type: 'article', siteName: SITE.name, locale: SITE.locale, url, title: p.title, description: p.excerpt,
      images: [{ url: ogImage(p), width: 1200, height: 630, alt: p.imageAlt }],
      publishedTime: p.createdAt, modifiedTime: p.updatedAt ?? p.createdAt, section: p.category, tags: p.tags,
    },
    twitter: { card: 'summary_large_image', title: p.title, description: p.excerpt, images: [ogImage(p)] },
  };
}

export default async function PostPage({ params }: P) {
  const p = getPost((await params).slug);
  if (!p) notFound();
  const c = catOf(p);
  const url = `${SITE.url}${postUrl(p)}`;
  const all = getPosts();
  const idx = all.findIndex((x) => x.slug === p.slug);
  const newer = all[idx - 1];
  const older = all[idx + 1];
  const rel = related(p, 6);
  const more = all.filter((x) => x.slug !== p.slug && !rel.includes(x)).slice(0, 4);
  const mid = Math.ceil(p.sections.length / 2);
  const rm = rel[0] ?? more[0]; // กล่อง "อ่านเพิ่มเติม" กลางบทความ
  const relGrid = rel.filter((x) => x !== rm).slice(0, 4);
  const moreGrid = more.filter((x) => x !== rm);

  return (
    <>
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@graph': [
            {
              '@type': 'NewsArticle',
              mainEntityOfPage: url,
              headline: p.title,
              description: p.excerpt,
              image: [`${SITE.url}${ogImage(p)}`],
              datePublished: p.createdAt,
              dateModified: p.updatedAt ?? p.createdAt,
              articleSection: p.category,
              keywords: p.tags.join(', '),
              inLanguage: 'th',
              wordCount: wordCount(p),
              author: { '@type': 'Organization', name: `กองบรรณาธิการ ${SITE.name}`, url: `${SITE.url}/about/` },
              publisher: { '@id': `${SITE.url}/#org` },
              isBasedOn: p.sources.map((s) => s.url),
            },
            {
              '@type': 'BreadcrumbList',
              itemListElement: [
                { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url },
                { '@type': 'ListItem', position: 2, name: c.name, item: `${SITE.url}/category/${c.slug}/` },
                { '@type': 'ListItem', position: 3, name: p.title, item: url },
              ],
            },
          ],
        }}
      />
      <ArticleChrome url={url} title={p.title} />
      <div className="cols">
        <article className="art">
          <header className="art-h">
            <nav className="crumbs" aria-label="breadcrumb">
              <ol>
                <li><a href="/">หน้าแรก</a></li>
                <li><a href={`/category/${c.slug}/`}>{c.name}</a></li>
              </ol>
            </nav>
            <h1>{p.title}</h1>
            <p className="lede">{p.excerpt}</p>
            <div className="meta" style={{ marginBottom: 14 }}>
              <span>โดย กองบรรณาธิการ {SITE.name}</span>
              <span className="dot" />
              <time dateTime={p.createdAt}>{thaiDate(p.createdAt)}</time>
              <span className="dot" />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ClockIcon width={14} height={14} /> อ่าน {readingMinutes(p)} นาที</span>
            </div>
            <Share url={url} title={p.title} />
          </header>

          {hasImg(p) && (
          <figure className="art-fig">
            <img src={displayImg(p)} srcSet={`${p.thumbSm} 640w, ${displayImg(p)} 1200w`} sizes="(max-width: 800px) 100vw, 760px" alt={p.imageAlt || p.title} width={1200} height={630} fetchPriority="high" />
            {p.imageCredit && <figcaption>ภาพ: {p.imageCredit}</figcaption>}
          </figure>
          )}

          <section className="tldr" aria-label="สรุปประเด็น">
            <h2>⚡ สรุปประเด็นสั้น ๆ</h2>
            <ul>{p.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
          </section>

          {/* 편집자 노트: 사람이 직접 남긴 코멘트 (텔레그램 답장 → scripts/editor-notes.mjs) */}
          {p.editorNote && (
            <aside className="ed-note" aria-label="มุมมองจากบรรณาธิการชาวเกาหลี">
              <b>🇰🇷 มุมมองจากบรรณาธิการชาวเกาหลี</b>
              <p>{p.editorNote}</p>
              {p.editorNoteAt && <small>{thaiDate(p.editorNoteAt)}</small>}
            </aside>
          )}

          <div className="prose">
            {p.sections.map((s, i) => (
              <section key={i}>
                <h2>{s.heading}</h2>
                {s.paragraphs.map((t, j) => <p key={j}>{t}</p>)}
                {i === mid - 1 && <AdSlot />}
                {i === 0 && rm && <ReadMore p={rm} />}
              </section>
            ))}

            {p.timeline.length > 0 && (
              <section>
                <h2>ไทม์ไลน์เหตุการณ์</h2>
                <ol className="timeline">{p.timeline.map((t, i) => <li key={i}><b>{t.when}</b>{t.what}</li>)}</ol>
              </section>
            )}

            {p.faq.length > 0 && (
              <section className="faq">
                <h2>คำถามที่หลายคนสงสัย</h2>
                {p.faq.map((f, i) => (
                  <details key={i} open={i === 0}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </section>
            )}
          </div>

          {SITE.shopee && (
            <a className="aff" href={`https://shopee.co.th/search?keyword=${encodeURIComponent(p.keyword)}&af_id=${SITE.shopee}`} rel="sponsored nofollow noopener" target="_blank">
              <span style={{ fontSize: 28 }} aria-hidden>🛒</span>
              <span><b>ดูสินค้าที่เกี่ยวข้องกับ “{p.keyword}”</b> บน Shopee<small>ลิงก์พันธมิตร — เราอาจได้รับค่าคอมมิชชันจากการซื้อ</small></span>
            </a>
          )}

          {/* 글이 2개 이상인 태그만 페이지가 있으므로 링크, 나머지는 텍스트 */}
          <div className="tags">{p.tags.map((t) => (tagHasPage(t) ? <a key={t} href={tagUrl(t)} className="chip">#{t}</a> : <span key={t} className="chip">#{t}</span>))}</div>

          <Share url={url} title={p.title} />

          <AdSlot />

          <footer className="srcs">
            <b>แหล่งข้อมูลอ้างอิง</b>
            <ul>{p.sources.map((s, i) => <li key={i}><a href={s.url} rel="nofollow noopener" target="_blank">{s.title}</a>{s.source ? ` — ${s.source}` : ''}</li>)}</ul>
            <p className="disc">บทความนี้เรียบเรียงด้วยความช่วยเหลือของ AI จากแหล่งข่าวข้างต้น และอาจมีการอัปเดตเมื่อมีข้อมูลใหม่ หากพบข้อผิดพลาด <a href="/contact/" style={{ textDecoration: 'underline' }}>แจ้งแก้ไขได้ที่นี่</a></p>
          </footer>

          {(newer || older) && (
            <nav className="prevnext" aria-label="บทความก่อนหน้าและถัดไป">
              {older && <a href={postUrl(older)}><small>‹ ก่อนหน้า</small><span className="clamp-2">{older.title}</span></a>}
              {newer && <a href={postUrl(newer)} className="next"><small>ถัดไป ›</small><span className="clamp-2">{newer.title}</span></a>}
            </nav>
          )}
        </article>
        <Sidebar exclude={p.slug} />
      </div>

      {relGrid.length > 0 && (
        <section className="sec" aria-labelledby="rel">
          <div className="sec-h"><h2 id="rel">📌 เรื่องที่เกี่ยวข้อง</h2></div>
          <div className="grid-4">{relGrid.map((x) => <Card key={x.slug} p={x} />)}</div>
        </section>
      )}
      {moreGrid.length > 0 && (
        <section className="sec" aria-labelledby="more">
          <div className="sec-h"><h2 id="more">⚡ ข่าวล่าสุด</h2><a href="/">ดูทั้งหมด ›</a></div>
          <div className="grid-4">{moreGrid.map((x) => <Card key={x.slug} p={x} />)}</div>
        </section>
      )}
    </>
  );
}
