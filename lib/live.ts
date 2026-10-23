import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';

// 반복 정보 허브 데이터 (scripts/live-data.mjs 가 수집)
export type Prize = { price: number; numbers: string[] };
export type Draw = { date: string; period: number[]; pdf: string; youtube: string; fetchedAt: string; prizes: Record<string, Prize> };
export type GoldRow = { date: string; time: string; round: number; bar: { buy: number; sell: number }; orn: { buy: number; sell: number } };

const LIVE = path.join(process.cwd(), 'content', 'live');

export const getDraws = cache((): Draw[] => {
  const dir = path.join(LIVE, 'lottery');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as Draw)
    .sort((a, b) => b.date.localeCompare(a.date));
});

export const getGold = cache((): { updatedAt: string; items: GoldRow[] } => {
  const f = path.join(LIVE, 'gold.json');
  if (!fs.existsSync(f)) return { updatedAt: '', items: [] };
  return JSON.parse(fs.readFileSync(f, 'utf8'));
});

// "16 ตุลาคม 2569" (불력 연도)
export const thaiLong = (ymd: string) => new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' });
export const thaiShort = (ymd: string) => new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
export const baht = (n: number) => n.toLocaleString('th-TH', { maximumFractionDigits: 2 });

// 다음 추첨일 (통상 매월 1일·16일). 공휴일로 옮겨지는 경우는 공식 발표 기준이라 "โดยปกติ" 로 표기
export function nextDrawDate(after: string): string {
  const d = new Date(`${after}T12:00:00+07:00`);
  const day = d.getDate();
  if (day < 16) return `${after.slice(0, 8)}16`;
  const n = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-01`;
}

export const PRIZE_LABEL: Record<string, string> = {
  first: 'รางวัลที่ 1',
  near1: 'รางวัลข้างเคียงรางวัลที่ 1',
  second: 'รางวัลที่ 2',
  third: 'รางวัลที่ 3',
  fourth: 'รางวัลที่ 4',
  fifth: 'รางวัลที่ 5',
  last3f: 'เลขหน้า 3 ตัว',
  last3b: 'เลขท้าย 3 ตัว',
  last2: 'เลขท้าย 2 ตัว',
};
