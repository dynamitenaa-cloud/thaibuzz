import type { Post } from './posts';

// 글마다 화면 틀을 다르게: 모든 글이 "요약 박스 → H2 → 타임라인 → FAQ 아코디언"이면 기계 티가 남.
// 결정은 slug 해시로 고정 → 재빌드해도 같은 글은 같은 틀
const hash = (s: string) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const pick = <T,>(arr: readonly T[], h: number, salt: number) => arr[(h + salt * 7919) % arr.length];

const TLDR = ['สรุปประเด็นสั้น ๆ', 'ประเด็นสำคัญ', 'รู้ไว้ก่อนอ่าน', 'สรุปให้ใน 10 วินาที', 'ใจความสำคัญ'] as const;
const FAQ = ['คำถามที่หลายคนสงสัย', 'ถาม-ตอบสั้น ๆ', 'คนถามกันเยอะ', 'ข้อสงสัยยอดฮิต'] as const;
const TL = ['ไทม์ไลน์เหตุการณ์', 'ลำดับเหตุการณ์', 'เกิดอะไรขึ้นบ้าง'] as const;
const KNOW = ['สิ่งที่ต้องรู้', 'เรื่องนี้สำคัญตรงไหน', 'จับประเด็นให้ครบ'] as const;

// 따옴표 인용이 있는 짧은 문단 → 인용 블록 (의미 변경 없음, 표시만)
const QUOTE = /[“"][^”"]{12,160}[”"]/;

export type Layout = {
  fmt: 'brief' | 'standard' | 'explainer' | 'qa' | 'list';
  summary: 'none' | 'box' | 'numbered' | 'inline';
  tldrHeading: string;
  runin: boolean; // 소제목을 H2 대신 문단 첫머리 굵은 글씨로
  numbered: boolean; // 소제목에 번호
  readMoreAfter: number; // -1 = 없음
  adAfter: number;
  timelineTop: boolean;
  timelineHeading: string;
  faq: 'none' | 'accordion' | 'headings';
  faqHeading: string;
  pullQuote: { section: number; para: number } | null;
  krAfter: number; // 한국 시각 박스를 몇 번째 섹션 뒤에 (-1 = 본문 끝)
};

export function layoutOf(p: Post): Layout {
  const h = hash(p.slug);
  const fmt = (['brief', 'standard', 'explainer', 'qa', 'list'] as const).includes(p.format as never) ? (p.format as Layout['fmt']) : 'standard';
  const n = p.sections.length;
  const mid = Math.max(0, Math.ceil(n / 2) - 1);

  let pullQuote: Layout['pullQuote'] = null;
  if (fmt === 'standard' || fmt === 'explainer') {
    outer: for (let i = 0; i < n; i++) for (let j = 0; j < p.sections[i].paragraphs.length; j++) {
      if (i === 0 && j === 0) continue;
      const t = p.sections[i].paragraphs[j];
      if ([...t].length <= 220 && QUOTE.test(t)) { pullQuote = { section: i, para: j }; break outer; }
    }
  }

  const base = { tldrHeading: pick(TLDR, h, 1), timelineHeading: pick(TL, h, 2), faqHeading: pick(FAQ, h, 3), adAfter: mid, pullQuote, krAfter: n >= 3 ? (h % 3 === 0 ? 0 : 1) : -1 };
  // 아침 정리 글: 본문 자체가 글 목록이라 '읽을거리' 추천 상자는 생략
  if (p.format === 'roundup') return { ...base, fmt: 'standard', summary: 'box', runin: false, numbered: false, readMoreAfter: -1, adAfter: -1, timelineTop: false, faq: 'none', pullQuote: null, krAfter: -1 };
  switch (fmt) {
    case 'brief':
      return { ...base, fmt, summary: 'none', runin: true, numbered: false, readMoreAfter: -1, timelineTop: false, faq: p.faq.length ? 'headings' : 'none', pullQuote: null };
    case 'qa':
      return { ...base, fmt, summary: 'inline', runin: false, numbered: false, readMoreAfter: n > 1 ? 0 : -1, timelineTop: false, faq: p.faq.length ? 'headings' : 'none', pullQuote: null };
    case 'list':
      return { ...base, fmt, summary: 'none', runin: false, numbered: true, readMoreAfter: n > 2 ? 1 : -1, timelineTop: false, faq: p.faq.length ? 'accordion' : 'none', pullQuote: null };
    case 'explainer':
      return { ...base, fmt, summary: 'numbered', tldrHeading: pick(KNOW, h, 4), runin: false, numbered: false, readMoreAfter: n > 2 ? 1 : 0, timelineTop: p.timeline.length >= 3, faq: p.faq.length >= 2 ? 'accordion' : 'none' };
    default:
      return { ...base, fmt: 'standard', summary: 'box', runin: false, numbered: false, readMoreAfter: h % 2 === 0 ? 0 : Math.min(1, n - 1), timelineTop: false, faq: p.faq.length >= 2 ? 'accordion' : p.faq.length === 1 ? 'headings' : 'none' };
  }
}
