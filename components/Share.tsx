'use client';
import { useEffect, useState } from 'react';
import { FbIcon, LineIcon, LinkIcon, ShareIcon, XIcon } from './Icons';

export function Share({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false);
  const [native, setNative] = useState(false);
  useEffect(() => setNative(typeof navigator !== 'undefined' && !!navigator.share), []);
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch {}
  };
  return (
    <div className="share">
      <span className="lbl sr-only">แชร์</span>
      <a className="line" href={`https://social-plugins.line.me/lineit/share?url=${u}`} target="_blank" rel="noopener" aria-label="แชร์ไปยัง LINE"><LineIcon /> LINE</a>
      <a className="fb" href={`https://www.facebook.com/sharer/sharer.php?u=${u}`} target="_blank" rel="noopener" aria-label="แชร์ไปยัง Facebook"><FbIcon /> Facebook</a>
      <a className="x" href={`https://x.com/intent/post?url=${u}&text=${t}`} target="_blank" rel="noopener" aria-label="แชร์ไปยัง X"><XIcon /> <span className="lbl">X</span></a>
      {/* ขนาดคงที่ทั้งสองโหมด → ไม่เกิด layout shift หลัง hydrate */}
      <button
        onClick={native ? () => navigator.share({ title, url }).catch(() => {}) : copy}
        aria-label={native ? 'แชร์' : 'คัดลอกลิงก์'}
        title={copied ? 'คัดลอกแล้ว' : native ? 'แชร์' : 'คัดลอกลิงก์'}
      >
        {native ? <ShareIcon /> : <LinkIcon />}
        <span className="sr-only" aria-live="polite">{copied ? 'คัดลอกแล้ว' : ''}</span>
      </button>
    </div>
  );
}

// แถบแชร์ติดล่างจอบนมือถือ + แถบความคืบหน้าการอ่าน
export function ArticleChrome({ url, title }: { url: string; title: string }) {
  const [on, setOn] = useState(false);
  const [pct, setPct] = useState(0);
  useEffect(() => {
    document.body.classList.add('has-share');
    const onScroll = () => {
      const el = document.querySelector('.art');
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - innerHeight;
      setPct(Math.min(100, Math.max(0, (-r.top / (total > 0 ? total : 1)) * 100)));
      setOn(scrollY > 400);
    };
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
    return () => { removeEventListener('scroll', onScroll); document.body.classList.remove('has-share'); };
  }, []);
  return (
    <>
      <div className="progress" style={{ width: `${pct}%` }} aria-hidden />
      <div className={`share-bar${on ? ' on' : ''}`}><Share url={url} title={title} /></div>
    </>
  );
}
