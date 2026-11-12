// Pinterest 용 세로형(2:3, 1000x1500) 이미지 생성. 핀터레스트는 가로형 사진을 거의 안 쓰므로 기사마다 따로 만듦.
//  - 최근 7일 글만 만들고(용량), 그보다 오래됐거나 글이 없는 핀 이미지는 삭제. 결과: public/pins/<slug>.jpg
//  - 사진이 있는 글(thumbClean)은 위쪽 사진 + 아래쪽 제목 패널, 없으면 색 배경 + 큰 제목
//  - 기사 페이지(app/post/[slug]/page.tsx)가 이 파일이 있으면 "핀터레스트에 저장" 블록으로 보여줌 → 핀터레스트가 이 이미지를 찾아 핀 생성 가능
// GITHUB_OUTPUT 에 changed=N. 실패해도 사이트 배포는 막지 않음
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { fonts, thaiWrap } from './lib/thumbs.mjs';

const DAYS = Number(process.env.PIN_DAYS || 7);
const POSTS = path.join('content', 'posts');
const OUT = path.join('public', 'pins');
fs.mkdirSync(OUT, { recursive: true });
const W = 1000, H = 1500, PH = 900; // PH = 사진 영역 높이
const COLOR = { 'บันเทิง': '#e11d48', 'K-บันเทิง': '#0047a0', 'ซีรีส์/หนัง': '#7c3aed', 'โซเชียล/ไวรัล': '#0ea5e9', 'ข่าวทั่วไป': '#475569', 'กีฬา': '#16a34a', 'ไลฟ์สไตล์': '#f59e0b' };
const h = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });

const now = Date.now();
const posts = fs.readdirSync(POSTS).filter((f) => f.endsWith('.json') && !f.startsWith('demo-'))
  .map((f) => JSON.parse(fs.readFileSync(path.join(POSTS, f), 'utf8')))
  .filter((p) => now - Date.parse(p.createdAt) < DAYS * 864e5 && p.format !== 'roundup');
const keep = new Set(posts.map((p) => `${p.slug}.jpg`));
let changed = 0;

// 오래된 핀 이미지 정리
for (const f of fs.readdirSync(OUT)) if (f.endsWith('.jpg') && !keep.has(f)) { fs.rmSync(path.join(OUT, f), { force: true }); changed++; }

const fontList = await fonts();
for (const p of posts) {
  const file = path.join(OUT, `${p.slug}.jpg`);
  if (fs.existsSync(file)) continue;
  try {
    const color = COLOR[p.category] || '#e11d48';
    const clean = p.thumbClean ? path.join('public', p.thumbClean) : '';
    let photo = null;
    if (clean && fs.existsSync(clean)) {
      const buf = await sharp(clean).resize(W, PH, { fit: 'cover', position: 'attention' }).jpeg({ quality: 82 }).toBuffer();
      photo = `data:image/jpeg;base64,${buf.toString('base64')}`;
    }
    const title = String(p.title || '').replace(/^\d+\s*เรื่องที่ต้องรู้เกี่ยวกับ\s*/, '5 เรื่องที่ต้องรู้: ').slice(0, 90);
    const len = [...title].length;
    const size = len > 70 ? 54 : len > 48 ? 62 : len > 30 ? 72 : 84;
    const tree = photo
      ? h('div', { width: W, height: H, display: 'flex', flexDirection: 'column', fontFamily: 'Prompt', background: '#111827', position: 'relative' }, [
          h('img', { width: W, height: PH }, undefined, { src: photo, width: W, height: PH }),
          h('div', { position: 'absolute', top: PH - 220, left: 0, width: W, height: 220, display: 'flex', backgroundImage: 'linear-gradient(180deg, rgba(17,24,39,0) 0%, #111827 100%)' }),
          h('div', { position: 'absolute', top: 40, left: 40, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 34, padding: '8px 22px', borderRadius: 999 }, [
            h('div', { width: 16, height: 16, borderRadius: 99, background: '#ff3b5c', display: 'flex' }), 'ThaiBuzz']),
          h('div', { position: 'absolute', top: PH - 90, left: 48, right: 48, bottom: 40, display: 'flex', flexDirection: 'column', gap: 22 }, [
            h('div', { display: 'flex' }, [h('div', { background: color, color: '#fff', fontSize: 34, padding: '6px 22px', borderRadius: 12 }, p.category)]),
            h('div', { color: '#fff', fontSize: size, lineHeight: 1.22, display: 'flex', flexWrap: 'wrap' }, thaiWrap(title)),
            h('div', { marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fde047', fontSize: 38 }, [
              h('div', { width: 160, height: 9, borderRadius: 9, background: '#fde047', display: 'flex' }), 'thaibuzz.net']),
          ]),
        ])
      : h('div', { width: W, height: H, display: 'flex', position: 'relative', fontFamily: 'Prompt', backgroundImage: `linear-gradient(160deg, ${color} 0%, #1e1b4b 100%)` }, [
          h('div', { position: 'absolute', top: -200, right: -200, width: 700, height: 700, borderRadius: 999, background: 'rgba(255,255,255,0.1)', display: 'flex' }),
          h('div', { position: 'absolute', bottom: -260, left: -240, width: 760, height: 760, borderRadius: 999, background: 'rgba(0,0,0,0.2)', display: 'flex' }),
          h('div', { position: 'absolute', top: 48, left: 48, display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(0,0,0,0.35)', color: '#fff', fontSize: 34, padding: '8px 22px', borderRadius: 999 }, [
            h('div', { width: 16, height: 16, borderRadius: 99, background: '#fde047', display: 'flex' }), 'ThaiBuzz']),
          h('div', { position: 'absolute', left: 64, right: 64, top: 200, bottom: 120, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 30 }, [
            h('div', { display: 'flex' }, [h('div', { background: 'rgba(255,255,255,0.95)', color, fontSize: 36, padding: '6px 24px', borderRadius: 12 }, p.category)]),
            h('div', { color: '#fff', fontSize: size + 10, lineHeight: 1.22, display: 'flex', flexWrap: 'wrap' }, thaiWrap(title)),
            h('div', { width: 180, height: 10, borderRadius: 10, background: '#fde047', display: 'flex' }),
          ]),
          h('div', { position: 'absolute', left: 64, bottom: 56, color: '#fde047', fontSize: 40, display: 'flex' }, 'thaibuzz.net'),
        ]);
    const svg = await satori(tree, { width: W, height: H, fonts: fontList });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
    await sharp(png).jpeg({ quality: 78, mozjpeg: true }).toFile(file);
    changed++;
  } catch (e) { console.warn(`pins: ${p.slug} 실패 — ${String(e.message).slice(0, 100)}`); }
}
console.log(`pins: ${posts.length}개 글 대상, ${changed}개 변경`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
