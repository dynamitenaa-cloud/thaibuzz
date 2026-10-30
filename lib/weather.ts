import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';

// 날씨 허브 (/weather/, /weather/<city>/). 데이터는 scripts/live-data.mjs 가 Open-Meteo(무료, 키 없음)에서 수집
// lat/lon 은 scripts/live-data.mjs 의 CITIES 와 같아야 함
export const CITIES = [
  { slug: 'bangkok', name: 'กรุงเทพฯ', full: 'กรุงเทพมหานคร' },
  { slug: 'chiang-mai', name: 'เชียงใหม่', full: 'เชียงใหม่' },
  { slug: 'phuket', name: 'ภูเก็ต', full: 'ภูเก็ต' },
  { slug: 'pattaya', name: 'พัทยา', full: 'พัทยา ชลบุรี' },
  { slug: 'khon-kaen', name: 'ขอนแก่น', full: 'ขอนแก่น' },
  { slug: 'korat', name: 'นครราชสีมา', full: 'นครราชสีมา (โคราช)' },
  { slug: 'udon-thani', name: 'อุดรธานี', full: 'อุดรธานี' },
  { slug: 'chiang-rai', name: 'เชียงราย', full: 'เชียงราย' },
  { slug: 'hat-yai', name: 'หาดใหญ่', full: 'หาดใหญ่ สงขลา' },
  { slug: 'hua-hin', name: 'หัวหิน', full: 'หัวหิน ประจวบคีรีขันธ์' },
] as const;
export type City = (typeof CITIES)[number];

export type Day = { date: string; code: number; max: number; min: number; rainProb: number; rainMm: number; uv: number };
export type CityData = { slug: string; fetchedAt: string; current: { time: string; temp: number; feels: number; humidity: number; wind: number; code: number; pm25: number | null }; days: Day[] };

export const getWeather = cache((): { updatedAt: string; cities: CityData[] } => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'live', 'weather.json'), 'utf8')); } catch { return { updatedAt: '', cities: [] }; }
});
export const cityBySlug = (s: string) => CITIES.find((c) => c.slug === s);

// WMO 날씨 코드 → 태국어 + 이모지
export function sky(code: number): { t: string; e: string } {
  if (code === 0) return { t: 'ท้องฟ้าแจ่มใส', e: '☀️' };
  if (code === 1 || code === 2) return { t: 'มีเมฆบางส่วน', e: '🌤️' };
  if (code === 3) return { t: 'มีเมฆมาก', e: '☁️' };
  if (code === 45 || code === 48) return { t: 'มีหมอก', e: '🌫️' };
  if (code >= 51 && code <= 57) return { t: 'ฝนปรอย', e: '🌦️' };
  if (code === 61 || code === 66) return { t: 'ฝนตกเล็กน้อย', e: '🌧️' };
  if (code === 63) return { t: 'ฝนตกปานกลาง', e: '🌧️' };
  if (code === 65 || code === 67) return { t: 'ฝนตกหนัก', e: '🌧️' };
  if (code === 80) return { t: 'ฝนตกเป็นช่วง ๆ', e: '🌦️' };
  if (code === 81) return { t: 'ฝนตกหนักเป็นช่วง ๆ', e: '🌧️' };
  if (code === 82) return { t: 'ฝนตกหนักมาก', e: '⛈️' };
  if (code === 95) return { t: 'พายุฝนฟ้าคะนอง', e: '⛈️' };
  if (code === 96 || code === 99) return { t: 'พายุฝนฟ้าคะนองและลูกเห็บ', e: '⛈️' };
  return { t: 'มีเมฆ', e: '⛅' };
}
// PM2.5 (µg/m³) 태국 오염관리국 기준 구간
export function pm(v: number | null): { t: string; c: string } {
  if (v == null) return { t: '-', c: 'var(--mut)' };
  if (v <= 15) return { t: 'ดีมาก', c: '#0ea5e9' };
  if (v <= 25) return { t: 'ดี', c: '#16a34a' };
  if (v <= 37.5) return { t: 'ปานกลาง', c: '#ca8a04' };
  if (v <= 75) return { t: 'เริ่มมีผลกระทบต่อสุขภาพ', c: '#ea580c' };
  return { t: 'มีผลกระทบต่อสุขภาพ', c: '#dc2626' };
}
export const dayName = (ymd: string) => new Date(`${ymd}T12:00:00+07:00`).toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
export const todayTh = () => new Date().toLocaleDateString('th-TH-u-ca-buddhist', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' });
export const r0 = (n: number) => Math.round(n);
