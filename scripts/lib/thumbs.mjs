// 썸네일: satori(JSX→SVG) → resvg(PNG) → sharp(JPG 1200 / WebP 640)
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

const ROOT = process.cwd();
const CACHE = path.join(ROOT, '.cache');
const OUT = path.join(ROOT, 'public', 'thumbs');
fs.mkdirSync(CACHE, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

// ฟอนต์เต็ม (ไทย + ละติน) จาก Google Fonts repo
const FONT_URL = 'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/prompt/Prompt-Bold.ttf';
let fontCache;
async function fonts() {
  if (fontCache) return fontCache;
  const f = path.join(CACHE, 'Prompt-Bold.ttf');
  if (!fs.existsSync(f)) {
    const r = await fetch(FONT_URL);
    if (!r.ok) throw new Error(`font ${r.status}`);
    fs.writeFileSync(f, Buffer.from(await r.arrayBuffer()));
  }
  fontCache = [{ name: 'Prompt', data: fs.readFileSync(f), weight: 700, style: 'normal' }];
  return fontCache;
}

// ภาษาไทยไม่มีช่องว่างระหว่างคำ → แทรก zero-width space ตามขอบเขตคำให้ satori ตัดบรรทัดได้ถูก
const seg = new Intl.Segmenter('th', { granularity: 'word' });
export const thaiWrap = (s) => [...seg.segment(s)].map((x) => x.segment).join('​');

export async function imageToDataUri(url, minWidth = 800) {
  if (!url) return null;
  try {
    const r = await fetch(url.startsWith('//') ? 'https:' + url : url, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; ThaiBuzzBot/1.0)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok || !/^image\//.test(r.headers.get('content-type') || '')) return null;
    const raw = Buffer.from(await r.arrayBuffer());
    const { width = 0 } = await sharp(raw).metadata();
    if (width < minWidth) return null; // ภาพเล็กเกินไป ขยายแล้วจะแตก (Discover ต้องการภาพคมชัด ≥1200px)
    const buf = await sharp(raw)
      .resize(1200, 630, { fit: 'cover', position: 'attention' })
      .jpeg({ quality: 85 })
      .toBuffer();
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

const h = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });

export async function makeThumb(slug, { text, category, color = '#e11d48', imageUrl, imageUrls = [], brand = 'ThaiBuzz' }) {
  // ลองทีละภาพ: ใช้ภาพแรกที่ความละเอียดพอ ถ้าไม่มีเลยใช้พื้นหลังไล่สี
  let bg = null, used = '';
  for (const u of [...imageUrls, imageUrl].filter(Boolean)) if ((bg = await imageToDataUri(u))) { used = u; break; }
  const len = [...text].length;
  const size = len > 40 ? 58 : len > 26 ? 68 : 80;
  const photoTree = h(
    'div',
    { width: 1200, height: 630, display: 'flex', position: 'relative', fontFamily: 'Prompt', background: `linear-gradient(135deg, ${color}, #1e1b4b)` },
    [
      bg && h('img', { position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }, undefined, { src: bg, width: 1200, height: 630 }),
      h('div', { position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(0,0,0,0) 25%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.92) 100%)' }),
      h('div', { position: 'absolute', top: 36, left: 44, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 28, padding: '6px 18px', borderRadius: 999 }, [
        h('div', { width: 14, height: 14, borderRadius: 99, background: '#ff3b5c', display: 'flex' }),
        brand,
      ]),
      h('div', { position: 'absolute', left: 44, right: 44, bottom: 44, display: 'flex', flexDirection: 'column', gap: 16 }, [
        h('div', { display: 'flex' }, [h('div', { background: color, color: '#fff', fontSize: 28, padding: '4px 18px', borderRadius: 10 }, category)]),
        h('div', { color: '#fff', fontSize: size, lineHeight: 1.22, display: 'flex', flexWrap: 'wrap', textShadow: '0 4px 18px rgba(0,0,0,0.6)' }, thaiWrap(text)),
        h('div', { width: 140, height: 8, borderRadius: 8, background: '#fde047', display: 'flex' }),
      ]),
    ].filter(Boolean),
  );
  // 사진이 없을 때: 아래가 검게 비는 대신 밝은 카테고리 색 + 큰 제목을 세로 가운데에 배치
  const plainTree = h(
    'div',
    { width: 1200, height: 630, display: 'flex', position: 'relative', fontFamily: 'Prompt', backgroundImage: `linear-gradient(135deg, ${color} 0%, #4c1d95 100%)` },
    [
      h('div', { position: 'absolute', top: -160, right: -120, width: 560, height: 560, borderRadius: 999, background: 'rgba(255,255,255,0.13)', display: 'flex' }),
      h('div', { position: 'absolute', bottom: -220, left: -140, width: 600, height: 600, borderRadius: 999, background: 'rgba(0,0,0,0.18)', display: 'flex' }),
      h('div', { position: 'absolute', top: 96, right: 250, width: 90, height: 90, borderRadius: 999, background: 'rgba(255,255,255,0.16)', display: 'flex' }),
      h('div', { position: 'absolute', top: 36, left: 44, display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 28, padding: '6px 18px', borderRadius: 999 }, [
        h('div', { width: 14, height: 14, borderRadius: 99, background: '#fde047', display: 'flex' }),
        brand,
      ]),
      h('div', { position: 'absolute', left: 64, right: 64, top: 120, bottom: 60, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }, [
        h('div', { display: 'flex' }, [h('div', { background: 'rgba(255,255,255,0.95)', color, fontSize: 30, padding: '4px 20px', borderRadius: 10 }, category)]),
        h('div', { color: '#fff', fontSize: size + 6, lineHeight: 1.22, display: 'flex', flexWrap: 'wrap', textShadow: '0 4px 20px rgba(0,0,0,0.35)' }, thaiWrap(text)),
        h('div', { width: 150, height: 9, borderRadius: 9, background: '#fde047', display: 'flex' }),
      ]),
    ],
  );
  const tree = bg ? photoTree : plainTree;
  const svg = await satori(tree, { width: 1200, height: 630, fonts: await fonts() });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
  // OG/Discover 용: 텍스트가 박힌 버전
  await sharp(png).jpeg({ quality: 72, mozjpeg: true }).toFile(path.join(OUT, `${slug}.jpg`));
  if (bg) {
    // 사이트 내 카드/헤드라인용: 텍스트 없는 깨끗한 사진 (제목이 HTML 로 따로 표시되므로 중복 방지)
    const photo = Buffer.from(bg.split(',')[1], 'base64');
    await sharp(photo).webp({ quality: 66, effort: 5 }).toFile(path.join(OUT, `${slug}-clean.webp`));
    await sharp(photo).resize(640).webp({ quality: 62 }).toFile(path.join(OUT, `${slug}-sm.webp`));
  } else {
    await sharp(png).webp({ quality: 66, effort: 5 }).toFile(path.join(OUT, `${slug}-lg.webp`));
    await sharp(png).resize(640).webp({ quality: 62 }).toFile(path.join(OUT, `${slug}-sm.webp`));
  }
  return {
    thumb: `/thumbs/${slug}.jpg`,
    thumbSm: `/thumbs/${slug}-sm.webp`,
    thumbClean: bg ? `/thumbs/${slug}-clean.webp` : '',
    thumbLg: bg ? `/thumbs/${slug}-clean.webp` : `/thumbs/${slug}-lg.webp`,
    hasPhoto: !!bg,
    imageUrl: used,
  };
}
