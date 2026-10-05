export const SITE = {
  name: process.env.NEXT_PUBLIC_SITE_NAME || 'ThaiBuzz',
  tagline: 'ข่าวฮิต ดราม่า เทรนด์ล่าสุด',
  description:
    'ThaiBuzz รวมประเด็นร้อน ข่าวบันเทิง ซีรีส์ เทรนด์ TikTok และ X ที่คนไทยกำลังพูดถึง สรุปกระชับ อ่านง่าย พร้อมอ้างอิงแหล่งข่าวต้นทาง อัปเดตตลอด 24 ชั่วโมง',
  url: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || 'contact@example.com',
  locale: 'th_TH',
  adsense: process.env.NEXT_PUBLIC_ADSENSE_ID || '',
  // 디스플레이 광고 단위의 data-ad-slot 값 (본문/목록용, 사이드바용). 없으면 자동 광고만 사용
  adsenseSlot: process.env.NEXT_PUBLIC_ADSENSE_SLOT || '',
  adsenseSlotSide: process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDE || '',
  shopee: process.env.NEXT_PUBLIC_SHOPEE_AFFILIATE_ID || '',
  gaId: process.env.NEXT_PUBLIC_GA_ID || '',
  perPage: 24,
};

// slug ↔ ชื่อหมวด (ต้องตรงกับ enum ใน scripts/run-pipeline.mjs)
export const CATEGORIES = [
  { slug: 'entertainment', name: 'บันเทิง', emoji: '🎤', color: '#e11d48' },
  { slug: 'series', name: 'ซีรีส์/หนัง', emoji: '🎬', color: '#7c3aed' },
  { slug: 'viral', name: 'โซเชียล/ไวรัล', emoji: '📱', color: '#0ea5e9' },
  { slug: 'news', name: 'ข่าวทั่วไป', emoji: '📰', color: '#475569' },
  { slug: 'sports', name: 'กีฬา', emoji: '⚽', color: '#16a34a' },
  { slug: 'lifestyle', name: 'ไลฟ์สไตล์', emoji: '✨', color: '#f59e0b' },
] as const;

export type Category = (typeof CATEGORIES)[number];
export const categoryByName = (name: string): Category =>
  CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[3];
export const categoryBySlug = (slug: string) => CATEGORIES.find((c) => c.slug === slug);
