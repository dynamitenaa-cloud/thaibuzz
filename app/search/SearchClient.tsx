'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchIcon } from '@/components/Icons';

type Doc = { s: string; t: string; e: string; k: string; g: string[]; c: string; i: string; d: string };

const norm = (s: string) => s.toLowerCase().normalize('NFC');

function Hi({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const i = norm(text).indexOf(norm(q));
  if (i < 0) return <>{text}</>;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

export default function SearchClient() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [q, setQ] = useState('');
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setQ(new URLSearchParams(location.search).get('q') ?? '');
    input.current?.focus();
    fetch('/search-index.json').then((r) => r.json()).then(setDocs).catch(() => setDocs([]));
  }, []);

  useEffect(() => {
    const u = new URL(location.href);
    if (q) u.searchParams.set('q', q); else u.searchParams.delete('q');
    history.replaceState(null, '', u);
  }, [q]);

  const results = useMemo(() => {
    if (!docs) return [];
    const terms = norm(q.trim()).split(/\s+/).filter(Boolean);
    if (!terms.length) return docs.slice(0, 12);
    return docs
      .map((d) => {
        const title = norm(d.t), body = norm(`${d.e} ${d.k} ${d.g.join(' ')} ${d.c}`);
        let score = 0;
        for (const t of terms) {
          if (title.includes(t)) score += 3;
          else if (body.includes(t)) score += 1;
          else return null;
        }
        return { d, score };
      })
      .filter((x): x is { d: Doc; score: number } => !!x)
      .sort((a, b) => b.score - a.score || b.d.d.localeCompare(a.d.d))
      .slice(0, 50)
      .map((x) => x.d);
  }, [docs, q]);

  return (
    <>
      <form className="search-box" role="search" onSubmit={(e) => e.preventDefault()}>
        <SearchIcon />
        <label htmlFor="q" className="sr-only">คำค้นหา</label>
        <input id="q" ref={input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="พิมพ์ชื่อดารา ซีรีส์ หรือประเด็น…" autoComplete="off" enterKeyHint="search" />
      </form>
      <p className="meta" aria-live="polite">
        {docs === null ? 'กำลังโหลด…' : q ? `พบ ${results.length} รายการสำหรับ “${q}”` : 'ข่าวล่าสุด'}
      </p>
      <div style={{ minHeight: '100vh' }}>
        {results.map((d) => (
          <article key={d.s} className="row">
            <div className="media">{d.i ? <img src={d.i} alt="" width={640} height={336} loading="lazy" /> : <div className="thumb-ph" aria-hidden>📰</div>}</div>
            <div>
              <div className="meta"><span className="cat">{d.c}</span></div>
              <h2 className="clamp-3" style={{ fontSize: '1.12rem' }}><a href={`/post/${d.s}/`}><Hi text={d.t} q={q.trim()} /></a></h2>
              <p className="clamp-2"><Hi text={d.e} q={q.trim()} /></p>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
