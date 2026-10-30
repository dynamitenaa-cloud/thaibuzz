// 허브(태그) 페이지 소개문 생성: 글 목록만 있는 허브에 "이 대상이 무엇이고 최근 무슨 일이 있었나"를 우리 기사 내용만으로 요약
//  → 검색 결과에서 단발 기사 대신 허브가 잡히게 (예: "the voice thailand 2026" → /tag/<slug>/)
//  - 대상: 글 3개 이상인 허브, 글이 많고 최근인 순. 실행당 최대 HUB_INTROS_PER_RUN(기본 3)개
//  - 재생성: 소개문이 없거나, 그 뒤 글이 2개 이상 늘었거나, 7일 지났을 때
//  - 저장: content/hubs/<slug>.json { tag, seoTitle, intro[], facts[], postCount, updatedAt }
//  - 실존 인물 정보를 지어내지 않도록 우리 기사 제목·요약만 근거로 줌
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { z } from 'zod';
import { generateJSON, FatalError, QuotaExhausted } from './lib/writer.mjs';

const POSTS = path.join('content', 'posts');
const HUBS = path.join('content', 'hubs');
const PER_RUN = Number(process.env.HUB_INTROS_PER_RUN || 3);
const MIN = 3;
const MOCK = process.argv.includes('--mock');
const ONLY = process.argv.find((a) => a.startsWith('--tag='))?.slice(6);
const out = (k, v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${k}=${v}\n`); };
const slugOf = (tag) => crypto.createHash('md5').update(tag.trim().toLowerCase()).digest('hex').slice(0, 8); // lib/posts.ts tagSlug 와 동일
fs.mkdirSync(HUBS, { recursive: true });

const posts = fs.readdirSync(POSTS).filter((f) => f.endsWith('.json') && !f.startsWith('demo-')).map((f) => JSON.parse(fs.readFileSync(path.join(POSTS, f), 'utf8')))
  .filter((p) => p.format !== 'roundup').sort((a, b) => b.createdAt.localeCompare(a.createdAt));
const by = new Map();
for (const p of posts) for (const t of p.tags || []) {
  const s = slugOf(t);
  const e = by.get(s) || { tag: t, slug: s, posts: [] };
  e.posts.push(p);
  by.set(s, e);
}
// 너무 넓은 태그는 소개문 의미 없음 → 제외
const GENERIC = /^(ข่าวบันเทิง|ตัวอย่าง|เทรนด์|ข่าววันนี้|ข่าว|ดารา|ไวรัล|ผลบอล|ผลบอลสด|k-?pop)$/i;
const now = Date.now();
const due = [...by.values()]
  .filter((h) => h.posts.length >= MIN && !GENERIC.test(h.tag.trim()) && (!ONLY || h.tag === ONLY || h.slug === ONLY))
  .map((h) => {
    const f = path.join(HUBS, `${h.slug}.json`);
    const cur = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    const stale = !cur || h.posts.length - (cur.postCount || 0) >= 2 || now - Date.parse(cur.updatedAt || 0) > 7 * 864e5;
    // 우선순위: 글 수 × 최근성
    const ageD = (now - Date.parse(h.posts[0].createdAt)) / 864e5;
    return { ...h, cur, stale, score: h.posts.length / (1 + ageD / 3) };
  })
  .filter((h) => h.stale)
  .sort((a, b) => b.score - a.score)
  .slice(0, PER_RUN);

if (!due.length) { console.log('hubs: 갱신할 허브 없음'); out('changed', 0); process.exit(0); }

const Schema = z.object({
  seoTitle: z.string().describe('หัวข้อหน้าสำหรับ Google 35-65 ตัวอักษร ขึ้นต้นด้วยชื่อหัวข้อ และใส่คำที่คนค้นหาจริงเกี่ยวกับหัวข้อนี้ (เช่น รายการ: "ทุก EP ย้อนหลัง ผลการแข่งขัน", ศิลปิน: "ข่าวล่าสุด ผลงาน", ทีมกีฬา: "ผลบอล โปรแกรม ข่าวล่าสุด") เฉพาะสิ่งที่มีในบทความที่ให้มา'),
  intro: z.array(z.string()).describe('2-3 ย่อหน้า ย่อหน้าละ 2-4 ประโยค: (1) หัวข้อนี้คืออะไร/ใคร ตามที่บทความระบุ (2) ช่วงนี้มีความเคลื่อนไหวอะไรบ้างเรียงตามเวลา (3) สิ่งที่น่าติดตามต่อ ถ้าบทความระบุไว้ ใช้เฉพาะข้อเท็จจริงจากบทความ ห้ามเดา'),
  facts: z.array(z.string()).describe('3-6 ข้อเท็จจริงสั้นที่คนค้นหาบ่อย (วันที่ ช่อง ชื่อ ผลลัพธ์ ตัวเลข) ข้อละ 1 บรรทัด เฉพาะที่มีในบทความ'),
});

let changed = 0;
for (const h of due) {
  const src = h.posts.slice(0, 12).map((p, i) => `${i + 1}. (${p.createdAt.slice(0, 10)}) ${p.title}\n   ${p.excerpt}\n   ${(p.summary || []).join(' / ')}`).join('\n');
  const prompt = `คุณคือบรรณาธิการเว็บข่าว ThaiBuzz เขียน "หน้ารวม" ของหัวข้อ "${h.tag}" เป็นภาษาไทย อ่านง่าย เป็นกลาง
ใช้เฉพาะข้อเท็จจริงจากบทความของเราด้านล่างเท่านั้น ห้ามเพิ่มข้อมูลส่วนตัว อายุ แฟน หรือสิ่งที่บทความไม่ได้ระบุ ห้ามมีอักษรเกาหลี

บทความของเราเกี่ยวกับ "${h.tag}" (ใหม่ → เก่า):
${src}`;
  try {
    const a = await generateJSON(prompt, Schema, { temperature: 0.4, model: MOCK ? (await import('./lib/mock-model.mjs')).hubMock : undefined });
    if (/[가-힣]/.test(JSON.stringify(a)) || !a.intro?.length) { console.log(`hubs: ${h.tag} 결과 부적합 → 건너뜀`); continue; }
    const rec = { tag: h.tag, seoTitle: a.seoTitle.trim(), intro: a.intro.map((x) => x.trim()).filter(Boolean).slice(0, 3), facts: (a.facts || []).map((x) => x.trim()).filter(Boolean).slice(0, 6), postCount: h.posts.length, updatedAt: new Date().toISOString() };
    fs.writeFileSync(path.join(HUBS, `${h.slug}.json`), JSON.stringify(rec, null, 2));
    changed++;
    console.log(`hubs: ✅ ${h.tag} (${h.posts.length}개 글) → ${rec.seoTitle}`);
  } catch (e) {
    if (e instanceof FatalError) { console.error('hubs: FATAL', e.message); process.exitCode = 1; break; }
    if (e instanceof QuotaExhausted) { console.log('hubs: 모델 한도 소진 → 다음 실행'); break; }
    console.warn(`hubs: ${h.tag} 실패 — ${String(e.message).slice(0, 150)}`);
  }
}
console.log(`hubs: ${changed}개 갱신`);
out('changed', changed > 0 ? 1 : 0);
