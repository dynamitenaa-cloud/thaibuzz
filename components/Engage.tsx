'use client';
import { useEffect, useRef, useState } from 'react';

// 글 하단 참여 박스: 원탭 투표 + 이모지 반응. /api/engage (Cloudflare D1) 와 통신.
// 화면에 가까워질 때만 불러와서 함수 호출 한도를 아낌. API 가 없거나 실패하면 아무것도 그리지 않음
const EMOJIS = ['😮', '😂', '😢', '😡', '❤️'];
type Snap = { votes: number[]; reacts: Record<string, number>; mine: { vote: number | null; reacts: string[] } };

export function Engage({ slug, question, options }: { slug: string; question?: string; options?: string[] }) {
  const box = useRef<HTMLElement>(null);
  const [s, setS] = useState<Snap | null>(null);
  const [busy, setBusy] = useState(false);
  const [dead, setDead] = useState(false); // API 없음(D1 미설정) → 박스 숨김

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let done = false;
    const load = () => {
      if (done) return; done = true;
      fetch(`/api/engage?slug=${slug}`).then((r) => (r.ok ? r.json() : null)).then((j) => (j ? setS(j) : setDead(true))).catch(() => setDead(true));
    };
    if (!('IntersectionObserver' in window)) { load(); return; }
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && (load(), io.disconnect()), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [slug]);

  const send = async (body: object) => {
    if (busy) return; setBusy(true);
    try {
      const r = await fetch('/api/engage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, ...body }) });
      if (r.ok) setS(await r.json());
    } catch {} finally { setBusy(false); }
  };

  const opts = (options || []).slice(0, 3);
  const total = s ? s.votes.slice(0, opts.length).reduce((a, b) => a + b, 0) : 0;
  const voted = s?.mine.vote != null;

  if (dead) return null;
  return (
    <section ref={box} className="engage" aria-label="ร่วมโหวตและแสดงความรู้สึก">
      {opts.length >= 2 && (
        <div className="poll">
          <h2>🗳️ {question?.trim() || 'คุณคิดยังไง?'}</h2>
          <div className="poll-opts" role="group">
            {opts.map((o, i) => {
              const n = s?.votes[i] ?? 0;
              const pct = total ? Math.round((n / total) * 100) : 0;
              return (
                <button key={i} type="button" className={`poll-opt${voted ? ' done' : ''}${s?.mine.vote === i ? ' mine' : ''}`} disabled={voted || busy || !s} onClick={() => send({ type: 'vote', opt: i })} aria-pressed={s?.mine.vote === i}>
                  {voted && <span className="bar" style={{ width: `${pct}%` }} />}
                  <span className="lbl">{s?.mine.vote === i ? '✓ ' : ''}{o}</span>
                  {voted && <b>{pct}%</b>}
                </button>
              );
            })}
          </div>
          <small className="poll-note">{s ? (voted ? `ขอบคุณที่ร่วมโหวต · ${total.toLocaleString('th-TH')} โหวต` : total ? `${total.toLocaleString('th-TH')} โหวตแล้ว — กดเพื่อดูผล` : 'เป็นคนแรกที่โหวต!') : ' '}</small>
        </div>
      )}
      <div className="reacts" role="group" aria-label="แสดงความรู้สึกต่อข่าวนี้">
        {EMOJIS.map((e) => {
          const on = s?.mine.reacts.includes(e);
          return (
            <button key={e} type="button" className={`react${on ? ' on' : ''}`} disabled={busy || !s} onClick={() => send({ type: 'react', emoji: e })} aria-pressed={!!on} aria-label={`รู้สึก ${e}`}>
              <span aria-hidden>{e}</span><b>{s?.reacts[e] ? s.reacts[e].toLocaleString('th-TH') : ''}</b>
            </button>
          );
        })}
      </div>
    </section>
  );
}
