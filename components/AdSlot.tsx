'use client';
import { useEffect, useRef } from 'react';
import { SITE } from '@/lib/site';

declare global { interface Window { adsbygoogle?: unknown[] } }

// AdSense 디스플레이 광고 단위는 data-ad-slot 이 필수. 슬롯 ID 가 없으면 빈 280px 상자만 남으므로 아예 그리지 않음.
// (슬롯 없이도 head 의 AdSense 스크립트로 "자동 광고"는 동작)
// 슬롯 ID: AdSense → 광고 → 광고 단위별 → 디스플레이 광고 생성 후 data-ad-slot 값
export default function AdSlot({ side = false }: { side?: boolean }) {
  const ref = useRef<HTMLModElement>(null);
  const client = SITE.adsense;
  const slot = side ? SITE.adsenseSlotSide || SITE.adsenseSlot : SITE.adsenseSlot;
  useEffect(() => {
    const el = ref.current;
    if (!el || !client || !slot) return;
    // 공간을 미리 잡아 두고(CLS 방지) 화면 근처에 왔을 때만 광고 요청
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
  }, [client, slot]);
  if (!client || !slot) return null;
  return (
    <div className={`ad${side ? ' ad-side' : ''}`}>
      <ins ref={ref} className="adsbygoogle" style={{ display: 'block' }} data-ad-client={client} data-ad-slot={slot} data-ad-format="auto" data-full-width-responsive="true" />
    </div>
  );
}
