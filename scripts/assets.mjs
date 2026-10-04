// 아이콘/기본 OG 이미지 생성 (한 번만 실행: npm run assets)
import fs from 'node:fs';
import sharp from 'sharp';
import { makeThumb } from './lib/thumbs.mjs';

const svg = fs.readFileSync('app/icon.svg');
await sharp(svg, { density: 600 }).resize(192).png().toFile('public/icon-192.png');
await sharp(svg, { density: 600 }).resize(512).png().toFile('public/icon-512.png');
await sharp(svg, { density: 600 }).resize(180).flatten({ background: '#e11d48' }).png().toFile('app/apple-icon.png');

const t = await makeThumb('_default', { text: 'ข่าวฮิต ดราม่า เทรนด์ล่าสุด อัปเดตทุกชั่วโมง', category: 'ThaiBuzz', color: '#e11d48' });
fs.copyFileSync(`public${t.thumb}`, 'app/opengraph-image.jpg');
fs.writeFileSync('app/opengraph-image.alt.txt', 'ThaiBuzz ข่าวฮิต ดราม่า เทรนด์ล่าสุด');
fs.rmSync(`public${t.thumb}`);
fs.rmSync(`public${t.thumbSm}`);
console.log('assets ok');
