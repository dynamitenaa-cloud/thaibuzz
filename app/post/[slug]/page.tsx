import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { catOf, displayImg, getPost, hasImg, ogImage, getPosts, postUrl, readingMinutes, related, tagHasPage, tagUrl, thaiDate, wordCount, type Post } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { EDITOR, editorId, editorUrl } from '@/lib/editor';
import { layoutOf } from '@/lib/article-layout';
import { CommentCta } from '@/components/CommentCta';
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

// 한국 시각 코너: AI 가 한국 출처에서 뽑은 맥락. 편집자 노트(사람)와 구분해 표기
function KoreaAngle({ text }: { text: string }) {
  return (
    <aside className="kr-angle" aria-label="ในเกาหลีมองเรื่องนี้ยังไง">
      <b>🇰🇷 ในเกาหลีมองเรื่องนี้ยังไง</b>
      <p>{text}</p>
      <small>เรียบเรียงจากสื่อเกาหลีที่อ้างอิงท้ายบทความ</small>
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
  const L = layoutOf(p);
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
              author: { '@id': editorId() },
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
              <span>โดย <a href={editorUrl()} rel="author" style={{ fontWeight: 600 }}>{EDITOR.name}</a></span>
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

          {L.summary === 'box' && (
            <section className="tldr" aria-label="สรุปประเด็น">
              <h2>⚡ {L.tldrHeading}</h2>
              <ul>{p.summary.map((s, i) => <li key={i}>{s}</li>)}</ul>
            </section>
          )}
          {L.summary === 'numbered' && (
            <section className="tldr know" aria-label="สรุปประเด็น">
              <h2>{L.tldrHeading}</h2>
              <ol>{p.summary.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </section>
          )}
          {L.summary === 'inline' && <p className="inline-sum"><b>สั้น ๆ:</b> {p.summary.join(' ')}</p>}

          {/* 편집자 노트: 사람이 직접 남긴 코멘트 (텔레그램 답장 → scripts/editor-notes.mjs) */}
          {p.editorNote && (
            <aside className="ed-note" aria-label="มุมมองจากบรรณาธิการชาวเกาหลี">
              <b>🇰🇷 มุมมองจาก <a href={editorUrl()}>{EDITOR.name}</a> บรรณาธิการชาวเกาหลี</b>
              <p>{p.editorNote}</p>
              {p.editorNoteAt && <small>{thaiDate(p.editorNoteAt)}</small>}
            </aside>
          )}

          {L.timelineTop && p.timeline.length > 0 && (
            <section className="tl-top">
              <h2>{L.timelineHeading}</h2>
              <ol className="timeline">{p.timeline.map((t, i) => <li key={i}><b>{t.when}</b>{t.what}</li>)}</ol>
            </section>
          )}

          <div className={`prose fmt-${L.fmt}${L.numbered ? ' numbered' : ''}`}>
            {p.sections.map((s, i) => (
              <section key={i}>
                {L.runin
                  ? s.paragraphs.map((t, j) => (
                      <p key={j}>{j === 0 && <strong className="runin">{s.heading} — </strong>}{t}</p>
                    ))
                  : (
                    <>
                      <h2>{s.heading}</h2>
                      {s.paragraphs.map((t, j) =>
                        L.pullQuote && L.pullQuote.section === i && L.pullQuote.para === j
                          ? <blockquote key={j} className="pullquote"><p>{t}</p></blockquote>
                          : <p key={j}>{t}</p>,
                      )}
                    </>
                  )}
                {i === L.adAfter && <AdSlot />}
                {i === L.readMoreAfter && rm && <ReadMore p={rm} />}
                {i === L.krAfter && p.koreaAngle && <KoreaAngle text={p.koreaAngle} />}
              </section>
            ))}
            {L.krAfter === -1 && p.koreaAngle && <KoreaAngle text={p.koreaAngle} />}

            {!L.timelineTop && p.timeline.length > 0 && (
              <section>
                <h2>{L.timelineHeading}</h2>
                <ol className="timeline">{p.timeline.map((t, i) => <li key={i}><b>{t.when}</b>{t.what}</li>)}</ol>
              </section>
            )}

            {L.faq === 'accordion' && (
              <section className="faq">
                <h2>{L.faqHeading}</h2>
                {p.faq.map((f, i) => (
                  <details key={i} open={i === 0}>
                    <summary>{f.q}</summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </section>
            )}
            {L.faq === 'headings' && (
              <section className="qa">
                {p.faq.map((f, i) => (
                  <div key={i}>
                    <h2>{f.q}</h2>
                    <p>{f.a}</p>
                  </div>
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

          <CommentCta slug={p.slug} question={p.question} />

          <AdSlot />

          <aside className="author-box" aria-label="เกี่ยวกับผู้เขียน">
            <img src={EDITOR.photo} alt={EDITOR.name} width={64} height={64} loading="lazy" />
            <div>
              <b><a href={editorUrl()} rel="author">{EDITOR.name}</a> · {EDITOR.jobTitle} {SITE.name}</b>
              <p>{EDITOR.bio[0]}</p>
            </div>
          </aside>

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
