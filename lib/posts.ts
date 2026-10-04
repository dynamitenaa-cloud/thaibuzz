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
  category: string;
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
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')) as Post)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
});

// ภาพสำหรับแสดงบนเว็บ: webp ถ้ามี, jpg (OG) เป็นทางสำรองสำหรับโพสต์เก่า
export const displayImg = (p: Post) => p.thumbClean || p.thumbLg || p.thumb;

export const getPost = (slug: string) => getPosts().find((p) => p.slug === slug);
export const postUrl = (p: Pick<Post, 'slug'>) => `/post/${p.slug}/`;
export const catOf = (p: Post): Category => categoryByName(p.category);

// แท็กภาษาไทย → slug สั้นแบบ ASCII เพื่อให้ path ของ static export ปลอดภัยทุกโฮสต์
export const tagSlug = (tag: string) => crypto.createHash('md5').update(tag.trim().toLowerCase()).digest('hex').slice(0, 8);
export const tagUrl = (tag: string) => `/tag/${tagSlug(tag)}/`;

export function getTags() {
  const map = new Map<string, { tag: string; count: number }>();
  for (const p of getPosts())
    for (const t of p.tags) {
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
