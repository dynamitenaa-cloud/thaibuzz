import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { cache } from 'react';
import { categoryByName, type Category } from './site';

export type Source = { title: string; url: string; source: string };
export type Section = { heading: string; paragraphs: string[] };

export type Post = {
  slug: string;
  title: string;
  excerpt: string;
  summary: string[];
  sections: Section[];
  timeline: { when: string; what: string }[];
  faq: { q: string; a: string }[];
  tags: string[];
  entities?: { name: string; type: 'person' | 'work' | 'group' | 'other' }[]; // 핵심 인물/작품 (허브 페이지 분류)
  category: string;
  editorNote?: string; // 편집자(사람)가 남긴 코멘트 (태국어)
  editorNoteAt?: string;
  format?: string; // 글 형식 (standard/brief/explainer/qa)
  model?: string; // 작성 모델
  lite?: boolean; // true = 썸네일 삭제된 오래된 글 (thumb* 가 빈 문자열)
  thumb: string; // 1200x630 jpg (OG / hero)
  thumbSm: string; // 640x336 webp (cards)
  thumbLg?: string; // 1200x630 webp สำหรับแสดงบนเว็บ (เบากว่า jpg)
  thumbClean?: string; // 1200x630 webp ภาพข่าวไม่มีตัวอักษร (มีเมื่อได้ภาพจากแหล่งข่าว)
  imageAlt: string;
  imageCredit: string;
  createdAt: string;
  updatedAt?: string;
  traffic: number;
  keyword: string;
  sources: Source[];
};

const DIR = path.join(process.cwd(), 'content', 'posts');

export const getPosts = cache((): Post[] => {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    // CI(실제 배포)에서는 데모 글을 절대 포함하지 않음. 로컬 미리보기에서만 사용
    .filter((f) => f.endsWith('.json') && !(process.env.CI && f.startsWith('demo-')))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Post)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

// ภาพสำหรับแสดงบนเว็บ: webp ถ้ามี, jpg (OG) เป็นทางสำรองสำหรับโพสต์เก่า
export const displayImg = (p: Post) => p.thumbClean || p.thumbLg || p.thumb;

// 오래된 글은 용량(Cloudflare Pages 20,000 파일 한도) 때문에 썸네일을 지우고 HTML 만 남김 (scripts/archive.mjs)
export const hasImg = (p: Post) => !!p.thumb;
export const ogImage = (p: Post) => p.thumb || '/og-default.jpg';

export const getPost = (slug: string) => getPosts().find((p) => p.slug === slug);
export const postUrl = (p: Pick<Post, 'slug'>) => `/post/${p.slug}/`;
export const catOf = (p: Post): Category => categoryByName(p.category);

// แท็กภาษาไทย → slug สั้นแบบ ASCII เพื่อให้ path ของ static export ปลอดภัยทุกโฮสต์
export const tagSlug = (tag: string) => crypto.createHash('md5').update(tag.trim().toLowerCase()).digest('hex').slice(0, 8);
export const tagUrl = (tag: string) => `/tag/${tagSlug(tag)}/`;

// 태그 페이지는 글이 2개 이상인 태그만 생성 (1개짜리는 내용이 빈약하고, 페이지 수가 폭증해 Cloudflare 파일 한도를 잠식)
export const MIN_TAG_POSTS = 2;
export const tagHasPage = (tag: string) => (getTags().get(tagSlug(tag))?.count ?? 0) >= MIN_TAG_POSTS;

// ── 인물·작품 허브 (= 태그 페이지를 확장) ──
// 글 3개 이상 쌓인 대상만 검색 색인 (그 미만은 페이지는 있되 noindex — 빈약한 페이지로 사이트 평가가 깎이지 않게)
export const MIN_HUB_INDEX = 3;
export type HubKind = 'person' | 'work' | 'group' | 'other';
export const HUB_LABEL: Record<HubKind, string> = { person: 'คนดัง', work: 'ซีรีส์/ผลงาน', group: 'วง/ทีม', other: 'ประเด็น' };

export const hubPosts = (slug: string) => getPosts().filter((p) => p.tags.some((t) => tagSlug(t) === slug));

// 글들의 entities 에서 이 이름이 어떤 종류로 가장 많이 분류됐는지 (없으면 other)
export function hubKind(name: string): HubKind {
  const n = name.trim().toLowerCase();
  const votes = new Map<HubKind, number>();
  for (const p of getPosts()) for (const e of p.entities ?? []) if (e.name.trim().toLowerCase() === n) votes.set(e.type, (votes.get(e.type) ?? 0) + 1);
  return [...votes].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'other';
}

export function hubs() {
  return [...getTags()]
    .filter(([, t]) => t.count >= MIN_TAG_POSTS)
    .map(([slug, t]) => {
      const posts = hubPosts(slug);
      return { slug, name: t.tag, count: t.count, kind: hubKind(t.tag), latest: posts[0]?.createdAt ?? '' };
    })
    .sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest));
}

// 일반어 태그("ข่าวบันเทิง", "ไวรัล" 등)는 카테고리 페이지와 중복이고 롱테일 효과도 없어 허브/태그 페이지를 만들지 않음
const GENERIC_TAGS = new Set([
  'บันเทิง', 'ดารา', 'ดาราไทย', 'คนดัง', 'ศิลปิน', 'นักแสดง', 'วงการบันเทิง', 'ซีรีส์', 'ซีรีส์ไทย', 'ละคร', 'หนัง', 'ภาพยนตร์', 'เพลง', 'เพลงใหม่',
  'ไวรัล', 'โซเชียล', 'ดราม่า', 'เทรนด์', 'กระแส', 'กีฬา', 'ฟุตบอล', 'ไลฟ์สไตล์', 'แฟชั่น', 'ความงาม', 'ท่องเที่ยว', 'อาหาร',
  'เกาหลี', 'kpop', 'k-pop', 'ซีรีส์เกาหลี', 'ไอดอล', 'ไอดอลเกาหลี', 'เคป๊อป',
  'ทดสอบ', 'ตัวอย่าง', 'ระบบอัตโนมัติ', 'ต่างประเทศ', 'ไทย', 'thailand', 'news',
]);
export const isGenericTag = (t: string) => {
  const s = t.trim().toLowerCase();
  return GENERIC_TAGS.has(s) || s.startsWith('ข่าว') || [...s].length < 2;
};

export function getTags() {
  const map = new Map<string, { tag: string; count: number }>();
  for (const p of getPosts())
    for (const t of p.tags) {
      if (isGenericTag(t)) continue;
      const s = tagSlug(t);
      const cur = map.get(s);
      map.set(s, { tag: cur?.tag ?? t, count: (cur?.count ?? 0) + 1 });
    }
  return map;
}

export const wordCount = (p: Post) =>
  [...new Intl.Segmenter('th', { granularity: 'word' }).segment(
    [p.summary.join(' '), ...p.sections.flatMap((s) => s.paragraphs)].join(' '),
  )].filter((s) => s.isWordLike).length;

// ภาษาไทยอ่านเฉลี่ย ~200 คำ/นาที
export const readingMinutes = (p: Post) => Math.max(1, Math.round(wordCount(p) / 200));

// คะแนน "มาแรง": ปริมาณค้นหา ลดทอนตามอายุ
// 홈 첫 화면: 상단 헤드라인 3개 + 나머지 목록. /page/n/ 도 같은 목록을 이어서 보여줘야 겹치거나 빠지는 글이 없음
export function homeFeed() {
  const posts = getPosts();
  const fresh = posts.filter((p) => Date.now() - Date.parse(p.createdAt) < 864e5);
  const top = trending(fresh.length >= 3 ? fresh : posts, 3);
  const used = new Set(top.map((p) => p.slug));
  return { top, rest: posts.filter((p) => !used.has(p.slug)) };
}

export function trending(posts: Post[], n: number) {
  const now = Date.now();
  return [...posts]
    .map((p) => {
      const ageH = (now - Date.parse(p.createdAt)) / 3.6e6;
      return { p, score: Math.log10((p.traffic || 100) + 10) / Math.pow(ageH + 2, 0.8) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((x) => x.p);
}

export function related(post: Post, n = 6) {
  const tags = new Set(post.tags);
  return getPosts()
    .filter((p) => p.slug !== post.slug)
    .map((p) => ({
      p,
      score: p.tags.filter((t) => tags.has(t)).length * 3 + (p.category === post.category ? 1 : 0),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.p.createdAt.localeCompare(a.p.createdAt))
    .slice(0, n)
    .map((x) => x.p);
}

export const thaiDate = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: 'numeric',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
