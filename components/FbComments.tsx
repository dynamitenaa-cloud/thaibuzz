'use client';
import { useEffect, useRef, useState } from 'react';

// 페이스북 댓글 플러그인. 댓글 영역이 화면에 들어올 때만 SDK 를 불러와 초기 로딩 속도를 지킴
declare global { interface Window { FB?: { XFBML: { parse: (el?: HTMLElement) => void } }; fbAsyncInit?: () => void } }

export function FbComments({ url, appId }: { url: string; appId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !appId) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setOn(true); io.disconnect(); } }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [appId]);
  useEffect(() => {
    if (!on) return;
    if (window.FB) { window.FB.XFBML.parse(ref.current ?? undefined); return; }
    if (document.getElementById('facebook-jssdk')) return;
    if (!document.getElementById('fb-root')) { const r = document.createElement('div'); r.id = 'fb-root'; document.body.appendChild(r); }
    const s = document.createElement('script');
    s.id = 'facebook-jssdk';
    s.async = true; s.defer = true; s.crossOrigin = 'anonymous';
    s.src = `https://connect.facebook.net/th_TH/sdk.js#xfbml=1&version=v21.0&appId=${encodeURIComponent(appId)}`;
    document.body.appendChild(s);
  }, [on]);
  if (!appId) return null;
  return (
    <section className="fb-cmt" aria-label="ความคิดเห็น" ref={ref}>
      <h2>💬 ความคิดเห็น</h2>
      <p className="fb-cmt-hint">คอมเมนต์ด้วยบัญชี Facebook ของคุณ — ความเห็นจะแสดงบนหน้านี้ และบรรณาธิการอ่านทุกข้อความ</p>
      {on ? <div className="fb-comments" data-href={url} data-width="100%" data-numposts="5" data-order-by="reverse_time" data-lazy="true" /> : <div className="fb-cmt-ph">กำลังโหลดกล่องความคิดเห็น…</div>}
    </section>
  );
}
