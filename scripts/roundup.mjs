// 아침 정리 코너 "สรุปข่าวเช้า": 지난 24시간 글 중 반응 좋은 5개를 묶어 글 1개로 발행 (매일 08:00 방콕, 1일 1회)
//  - 일반 글과 같은 형식이라 사이트·페북·Threads·릴스까지 그대로 나감 (릴스는 상위 3개 헤드라인 낭독 + 마지막에 편집자 얼굴)
//  - 선택 기준: 검색량·최신성(trending 점수) + 카테고리 다양성(같은 카테고리 최대 2개) + K-연예 1개 이상
//  - 실행 조건: 방콕 시각 08시대(또는 FORCE_ROUNDUP=true) 이고 오늘 분이 아직 없을 때. --mock 으로 키 없이 시험
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { generateJSON, FatalError, QuotaExhausted } from './lib/writer.mjs';
import { makeThumb } from './lib/thumbs.mjs';

const POSTS = path.join('content', 'posts');
const CACHE = '.cache';
const KR_CAT = 'K-บันเทิง';
const CAT_COLOR = { 'บันเทิง': '#e11d48', 'ซีรีส์/หนัง': '#7c3aed', 'โซเชียล/ไวรัล': '#0ea5e9', 'ข่าวทั่วไป': '#475569', 'กีฬา': '#16a34a', 'ไลฟ์สไตล์': '#f59e0b', 'K-บันเทิง': '#0047a0' };
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thaibuzz.net').replace(/\/$/, '');
const MOCK = process.argv.includes('--mock');
const FORCE = process.argv.includes('--force') || process.env.FORCE_ROUNDUP === 'true';
const out = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };

const bkk = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' }); // YYYY-MM-DD
const slug = `${today.replace(/-/g, '')}-roundup`;
if (!FORCE && bkk.getHours() !== 8) { console.log(`roundup: 방콕 ${bkk.getHours()}시 → 08시에만 실행`); out('changed', 0); process.exit(0); }
if (fs.existsSync(path.join(POSTS, `${slug}.json`))) { console.log('roundup: 오늘 분 이미 있음'); out('changed', 0); process.exit(0); }

const all = fs.readdirSync(POSTS).filter((f) => f.endsWith('.json') && !f.startsWith('demo-')).map((f) => JSON.parse(fs.readFileSync(path.join(POSTS, f), 'utf8')));
const now = Date.now();
const recent = all.filter((p) => p.format !== 'roundup' && now - Date.parse(p.createdAt) < 26 * 36e5);
if (recent.length < 4) { console.log(`roundup: 최근 글 ${recent.length}개 → 4개 미만이라 건너뜀`); out('changed', 0); process.exit(0); }
const score = (p) => Math.log10((p.traffic || 100) + 10) / Math.pow((now - Date.parse(p.createdAt)) / 3.6e6 + 2, 0.5) + (p.editorNote ? 0.3 : 0) + (p.thumbClean ? 0.1 : 0);
const ranked = [...recent].sort((a, b) => score(b) - score(a));
const picks = [];
const perCat = {};
const kFirst = ranked.find((p) => p.category === KR_CAT);
if (kFirst) { picks.push(kFirst); perCat[KR_CAT] = 1; }
for (const p of ranked) {
  if (picks.length >= 5) break;
  if (picks.includes(p) || (perCat[p.category] || 0) >= 2) continue;
  picks.push(p); perCat[p.category] = (perCat[p.category] || 0) + 1;
}
console.log(`roundup: 후보 ${recent.length} → 선택 ${picks.length}`);
picks.forEach((p, i) => console.log(`  ${i + 1}. [${p.category}] ${p.title}`));

const dateTh = new Date(`${today}T08:00:00+07:00`).toLocaleDateString('th-TH-u-ca-buddhist', { day: 'numeric', month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' });
const Schema = z.object({
  title: z.string().describe(`พาดหัว 50-90 ตัวอักษร ขึ้นต้นด้วย "สรุปข่าวเช้า ${dateTh}:" แล้วตามด้วย 2-3 ประเด็นเด่นสั้น ๆ คั่นด้วยจุลภาค`),
  excerpt: z.string().describe('คำโปรย 100-150 ตัวอักษร บอกว่าเช้านี้มีอะไรต้องรู้บ้าง ภาษาพูด'),
  intro: z.string().describe('ย่อหน้าเปิด 2-3 ประโยค ทักทายผู้อ่านตอนเช้าแบบเป็นกันเอง (ไม่ซ้ำแบบเดิม ๆ) แล้วบอกว่ามีข่าวอะไรรอบนี้'),
  headlines: z.array(z.string()).describe('สรุปข่าวแต่ละข้อ ข้อละ 1 ประโยค (เรียงตามลำดับที่ให้มา จำนวนเท่ากับข่าวที่ให้) ภาษากระชับ ไม่ลอกพาดหัวเดิมตรง ๆ'),
  thumbText: z.string().describe('ข้อความบนภาพปก 10-28 ตัวอักษร เช่น "สรุปข่าวเช้า 24 ต.ค." หรือประเด็นเด่นที่สุด'),
  socialHook: z.string().describe('แคปชันโซเชียล 1 บรรทัด ไม่เกิน 60 ตัวอักษร ภาษาพูด เช่น "ตื่นมาเจอข่าวนี้ก่อนเลย" ห้ามอีโมจิ'),
  socialQuestion: z.string().describe('คำถามชวนคอมเมนต์ 1 ประโยค ไม่เกิน 60 ตัวอักษร เกี่ยวกับข่าวเด่นที่สุดของเช้านี้'),
});
const prompt = `คุณคือบรรณาธิการเพจข่าว ThaiBuzz เขียน "สรุปข่าวเช้า" ประจำวันที่ ${dateTh} ภาษาไทย อ่านง่าย เป็นกันเอง ไม่ใช่สำนวนหุ่นยนต์ ใช้เฉพาะข้อเท็จจริงจากรายการด้านล่าง ห้ามแต่งเพิ่ม ห้ามมีอักษรเกาหลี

ข่าวที่เลือกมา (เรียงตามลำดับ):
${picks.map((p, i) => `${i + 1}. [${p.category}] ${p.title}\n   ${p.excerpt}\n   สรุป: ${(p.summary || []).slice(0, 2).join(' / ')}`).join('\n')}`;

let a;
try {
  a = await generateJSON(prompt, Schema, { temperature: 0.7, premium: true, model: MOCK ? (await import('./lib/mock-model.mjs')).roundupMock : undefined });
} catch (e) {
  if (e instanceof FatalError) { console.error('roundup: FATAL', e.message); process.exitCode = 1; }
  else if (e instanceof QuotaExhausted) console.log('roundup: 모델 한도 소진 → 다음 시간에 재시도');
  else console.error('roundup: 실패', e.message);
  out('changed', 0); process.exit();
}
if (/[가-힣]/.test(JSON.stringify(a))) { console.log('roundup: 한글 섞임 → 건너뜀'); out('changed', 0); process.exit(0); }
const headlines = (a.headlines || []).slice(0, picks.length);
while (headlines.length < picks.length) headlines.push(picks[headlines.length].excerpt);

const cover = picks.find((p) => p.thumbClean) || picks[0];
const t = await makeThumb(slug, { text: a.thumbText || `สรุปข่าวเช้า ${dateTh}`, category: 'สรุปข่าวเช้า', color: '#111827', imageUrls: cover.thumbClean ? [`${SITE}${cover.thumbClean}`] : [] });
const post = {
  slug,
  title: a.title.startsWith('สรุปข่าวเช้า') ? a.title : `สรุปข่าวเช้า ${dateTh}: ${a.title}`,
  excerpt: a.excerpt,
  summary: headlines.slice(0, 3),
  sections: [{ heading: `เช้านี้มีอะไรบ้าง (${picks.length} เรื่อง)`, paragraphs: [a.intro] }],
  timeline: [],
  faq: [],
  tags: [...new Set(['สรุปข่าวเช้า', ...picks.flatMap((p) => (p.entities || []).slice(0, 1).map((e) => e.name))])].slice(0, 7),
  entities: [],
  category: 'ข่าวทั่วไป',
  format: 'roundup',
  roundup: picks.map((p, i) => ({ slug: p.slug, title: p.title, line: headlines[i], category: p.category, thumbSm: p.thumbSm || '' })),
  thumb: t.thumb, thumbSm: t.thumbSm, thumbClean: t.thumbClean, thumbLg: t.thumbLg,
  imageAlt: `สรุปข่าวเช้า ${dateTh}`,
  imageCredit: '',
  createdAt: new Date().toISOString(),
  traffic: Math.max(...picks.map((p) => p.traffic || 0)),
  keyword: `สรุปข่าวเช้า ${dateTh}`,
  hook: a.socialHook?.trim() || undefined,
  question: a.socialQuestion?.trim() || undefined,
  model: MOCK ? 'mock' : 'roundup',
  sources: picks.map((p) => ({ title: p.title, url: `${SITE}/post/${p.slug}/`, source: 'ThaiBuzz' })),
};
fs.writeFileSync(path.join(POSTS, `${slug}.json.tmp`), JSON.stringify(post, null, 2));
fs.renameSync(path.join(POSTS, `${slug}.json.tmp`), path.join(POSTS, `${slug}.json`));
fs.mkdirSync(CACHE, { recursive: true });
fs.appendFileSync(path.join(CACHE, 'new-urls.txt'), `\n/post/${slug}/`);
console.log(`roundup: ✅ ${post.title}`);
out('changed', 1);
