'use client';
import { useEffect, useRef } from 'react';

declare global { interface Window { adsbygoogle?: unknown[] } }

// พื้นที่โฆษณาจองความสูงไว้ล่วงหน้า (กัน CLS) และ push เมื่อใกล้เข้าจอเท่านั้น
export default function AdSlot({ client, slot, side = false }: { client: string; slot?: string; side?: boolean }) {
  const ref = useRef<HTMLModElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !client) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch {}
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [client]);
  if (!client) return null;
  return (
    <div className={`ad${side ? ' ad-side' : ''}`}>
      <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
}
