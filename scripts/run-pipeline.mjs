// 트렌드 감지 → 근거 수집 → 태국어 기사 생성 → 품질 게이트 → 썸네일 → content/posts/*.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { trendsTH, newsTopicTH, searchNews, fetchArticleText, similarity, jaccard } from './lib/sources.mjs';
import { writeArticle, qualityCheck, normalize, FatalError } from './lib/writer.mjs';
import { makeThumb } from './lib/thumbs.mjs';

const ROOT = process.cwd();
const POSTS = path.join(ROOT, 'content', 'posts');
const CACHE = path.join(ROOT, '.cache');
const MAX_PER_RUN = Number(process.env.MAX_PER_RUN || 3);
const MAX_PER_DAY = Number(process.env.MAX_PER_DAY || 40);
const DRY = process.argv.includes('--dry'); // LLM 호출 없이 후보/근거만 출력
const MODEL = process.argv.includes('--mock') ? (await import('./lib/mock-model.mjs')).default : undefined; // 키 없이 전체 흐름 시험
fs.mkdirSync(POSTS, { recursive: true });
fs.mkdirSync(CACHE, { recursive: true });

// lib/site.ts 의 CATEGORIES 와 동일하게 유지
const CAT_COLOR = { 'บันเทิง': '#e11d48', 'ซีรีส์/หนัง': '#7c3aed', 'โซเชียล/ไวรัล': '#0ea5e9', 'ข่าวทั่วไป': '#475569', 'กีฬา': '#16a34a', 'ไลฟ์สไตล์': '#f59e0b' };

// 이미 시도했다 거절된 키워드는 24시간 동안 재시도 안 함 (무료 쿼터 절약)
const REJECT_FILE = path.join(CACHE, 'rejected.json');
const rejected = fs.existsSync(REJECT_FILE) ? JSON.parse(fs.readFileSync(REJECT_FILE, 'utf8')) : {};
for (const [k, t] of Object.entries(rejected)) if (Date.now() - t > 864e5) delete rejected[k];
const saveRejected = () => fs.writeFileSync(REJECT_FILE, JSON.stringify(rejected));

const existing = fs.readdirSync(POSTS).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(POSTS, f), 'utf8')))
  .filter((p) => !p.slug.startsWith('demo-')); // 데모 글은 예산/중복 계산에서 제외
const recent = existing.filter((p) => Date.now() - Date.parse(p.createdAt) < 3 * 864e5);
const publishedToday = existing.filter((p) => Date.now() - Date.parse(p.createdAt) < 864e5).length;
let budget = Math.min(MAX_PER_RUN, MAX_PER_DAY - publishedToday);

const isDup = (kw) =>
  rejected[kw.toLowerCase()] ||
  recent.some((p) => p.keyword.toLowerCase() === kw.toLowerCase() || similarity(kw, p.keyword) >= 0.7 || jaccard(kw, p.title) >= 0.6);

async function gather() {
  const results = await Promise.allSettled([trendsTH(), newsTopicTH('ENTERTAINMENT')]);
  results.filter((r) => r.status === 'rejected').forEach((r) => console.warn('source failed:', r.reason?.message));
  const [trends = [], ent = []] = results.map((r) => (r.status === 'fulfilled' ? r.value : []));
  // 검색량 큰 트렌드 우선, 연예 헤드라인을 사이사이에 섞어 니치 커버
  trends.sort((a, b) => b.traffic - a.traffic);
  const merged = [];
  for (let i = 0; i < Math.max(trends.length, ent.length); i++) {
    if (trends[i]) merged.push(trends[i]);
    if (ent[i]) merged.push(ent[i]);
  }
  const out = [];
  for (const c of merged) if (!isDup(c.keyword) && !out.some((o) => similarity(o.keyword, c.keyword) >= 0.7)) out.push(c);
  return out;
}

async function buildFacts(c) {
  const more = await searchNews(c.query || c.keyword);
  const seen = new Set();
  const news = [...c.news, ...more].filter((n) => n.title && !seen.has(n.title) && seen.add(n.title)).slice(0, 8);
  // 원문 URL(직접 링크)이 있는 상위 2개 기사 본문을 근거로 추가
  const bodies = await Promise.all(news.filter((n) => n.url && !n.url.includes('news.google.com')).slice(0, 2).map((n) => fetchArticleText(n.url)));
  const facts = [
    ...news.map((n, i) => `[${i + 1}] ${n.source || 'ไม่ระบุ'}: ${n.title}${n.snippet ? `\n${n.snippet}` : ''}`),
    ...bodies.filter((b) => b.text).map((b, i) => `\n[เนื้อหาจากแหล่งข่าว ${i + 1}]\n${b.text}`),
  ].join('\n');
  // og:image ของต้นฉบับมักคมชัดที่สุด → ลองก่อน แล้วค่อยภาพจาก Trends
  const direct = news.filter((n) => n.url && !n.url.includes('news.google.com')).slice(0, 2);
  const images = [
    ...bodies.map((b, i) => ({ url: b.image, credit: direct[i]?.source })),
    { url: c.picture, credit: c.pictureSource },
    ...news.map((n) => ({ url: n.picture, credit: n.source })),
  ].filter((x) => x.url && process.env.USE_SOURCE_IMAGES !== 'false'); // false → ใช้ภาพปกไล่สี+ข้อความเท่านั้น
  return { news, facts, images, richness: news.length + bodies.filter((b) => b.text).length * 2 };
}

const newUrls = [];
let fatal = null;
console.log(`budget: ${budget} (today ${publishedToday}/${MAX_PER_DAY})`);

if (budget > 0) {
  const candidates = await gather();
  console.log(`candidates: ${candidates.length}`);
  for (const c of candidates) {
    if (budget <= 0) break;
    console.log(`\n▶ ${c.keyword} [${c.origin}] traffic=${c.traffic}`);
    try {
      const f = await buildFacts(c);
      if (f.richness < 3) { console.log('  skip: not enough sources'); rejected[c.keyword.toLowerCase()] = Date.now(); continue; }
      if (DRY) { console.log(f.facts.slice(0, 800)); budget--; continue; }

      const raw = await writeArticle(c, f.facts, MODEL);
      const q = qualityCheck(raw);
      if (!q.ok) { console.log('  rejected:', q.problems.join('; ')); rejected[c.keyword.toLowerCase()] = Date.now(); continue; }
      const a = normalize(raw);
      if (recent.some((p) => jaccard(a.title, p.title) >= 0.6)) { console.log('  skip: duplicate story'); continue; }

      const now = new Date();
      const slug = `${now.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.createHash('md5').update(c.keyword + now.toISOString()).digest('hex').slice(0, 8)}`;
      const t = await makeThumb(slug, { text: a.thumbText, category: a.category, color: CAT_COLOR[a.category], imageUrls: f.images.map((x) => x.url) });
      const post = {
        slug,
        title: a.title,
        excerpt: a.excerpt,
        summary: a.summary,
        sections: a.sections,
        timeline: a.timeline,
        faq: a.faq,
        tags: a.tags,
        category: a.category,
        thumb: t.thumb,
        thumbSm: t.thumbSm,
        thumbClean: t.thumbClean,
        thumbLg: t.thumbLg,
        imageAlt: a.imageAlt,
        imageCredit: t.hasPhoto ? f.images.find((x) => x.url === t.imageUrl)?.credit || '' : '',
        createdAt: now.toISOString(),
        traffic: c.traffic,
        keyword: c.keyword,
        sources: f.news.slice(0, 6).map(({ title, url, source }) => ({ title, url, source })),
      };
      fs.writeFileSync(path.join(POSTS, `${slug}.json`), JSON.stringify(post, null, 2));
      recent.push(post);
      newUrls.push(`/post/${slug}/`);
      console.log(`  ✅ published (${q.words} words): ${a.title}`);
      budget--;
    } catch (e) {
      console.error('  ❌ failed:', e.message);
      if (e instanceof FatalError) { fatal = e; break; }
    }
  }
}

saveRejected();
fs.writeFileSync(path.join(CACHE, 'new-urls.txt'), newUrls.join('\n'));
console.log(`\ndone: ${newUrls.length} new`);
// 설정 문제(모델 단종/키 오류)는 워크플로를 실패 처리 → GitHub 이메일 알림
if (fatal) { console.error('FATAL: 설정 문제로 중단 (GEMINI_MODEL 변수 / API 키 확인)'); process.exitCode = 1; }
// GitHub Actions 에서 다음 단계(빌드/배포) 실행 여부 판단용
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `published=${newUrls.length}\n`);
