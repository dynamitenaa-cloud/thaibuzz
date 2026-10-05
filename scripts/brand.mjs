// 브랜드 이미지 생성 (Facebook 커버/프로필): `node scripts/brand.mjs` → brand/ 폴더
import fs from 'node:fs';
import path from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { thaiWrap } from './lib/thumbs.mjs';

fs.mkdirSync('brand', { recursive: true });
const fontFile = '.cache/Prompt-Bold.ttf';
if (!fs.existsSync(fontFile)) {
  fs.mkdirSync('.cache', { recursive: true });
  const r = await fetch('https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/prompt/Prompt-Bold.ttf');
  fs.writeFileSync(fontFile, Buffer.from(await r.arrayBuffer()));
}
const font = fs.readFileSync(fontFile);
const logo = `data:image/png;base64,${fs.readFileSync('public/icon-512.png').toString('base64')}`;

const h = (type, style, children, extra = {}) => ({ type, props: { style, children, ...extra } });

// 커버: 1640×624. 모바일은 좌우가 크게 잘리므로 핵심 요소를 가운데 ~1000px 안에 배치
const W = 1640, H = 624;
const tree = h('div', { width: W, height: H, display: 'flex', position: 'relative', fontFamily: 'Prompt', backgroundImage: 'linear-gradient(120deg, #e11d48 0%, #f97316 45%, #7c3aed 100%)' }, [
  // 장식 원
  h('div', { position: 'absolute', top: -180, left: -120, width: 520, height: 520, borderRadius: 999, background: 'rgba(255,255,255,0.10)', display: 'flex' }),
  h('div', { position: 'absolute', bottom: -240, right: -80, width: 640, height: 640, borderRadius: 999, background: 'rgba(0,0,0,0.16)', display: 'flex' }),
  h('div', { position: 'absolute', top: 70, right: 220, width: 120, height: 120, borderRadius: 999, background: 'rgba(255,255,255,0.12)', display: 'flex' }),
  h('div', { position: 'absolute', left: 0, top: 0, width: W, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }, [
    h('div', { display: 'flex', alignItems: 'center', gap: 44 }, [
      h('img', { width: 190, height: 190, borderRadius: 44, boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }, undefined, { src: logo, width: 190, height: 190 }),
      h('div', { display: 'flex', flexDirection: 'column', gap: 8 }, [
        h('div', { color: '#fff', fontSize: 132, lineHeight: 1.05, display: 'flex', textShadow: '0 6px 24px rgba(0,0,0,0.30)' }, 'ThaiBuzz'),
        h('div', { color: '#fff', fontSize: 58, lineHeight: 1.3, display: 'flex' }, 'ข่าวฮิต ดราม่า เทรนด์ไทย'),
        h('div', { display: 'flex', marginTop: 8 }, [
          h('div', { background: 'rgba(0,0,0,0.38)', color: '#fde047', fontSize: 30, padding: '6px 22px', borderRadius: 999, display: 'flex' }, 'อัปเดตทุกชั่วโมง · มีแหล่งอ้างอิงทุกข่าว'),
        ]),
      ]),
    ]),
  ]),
]);
const svg = await satori(tree, { width: W, height: H, fonts: [{ name: 'Prompt', data: font, weight: 700, style: 'normal' }] });
const png = new Resvg(svg).render().asPng();
await sharp(png).jpeg({ quality: 92, mozjpeg: true }).toFile('brand/facebook-cover-1640x624.jpg');

// 프로필: 정사각형 (페이스북이 원형으로 잘라 보여줌). 로고를 여백 두고 배치
// 모서리가 둥근 아이콘 대신 꽉 찬 정사각형 (페이스북이 알아서 원형으로 자르므로 모서리가 검게 나오지 않게)
const square = fs.readFileSync('app/icon.svg', 'utf8').replace(/rx="\d+"/, 'rx="0"');
await sharp(Buffer.from(square), { density: 1200 }).resize(720, 720).jpeg({ quality: 94 }).toFile('brand/facebook-profile-720.jpg');
console.log('brand/ 에 생성 완료:', fs.readdirSync('brand').join(', '));
