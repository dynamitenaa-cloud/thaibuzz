// 트렌드 감지 → 근거 수집 → 태국어 기사 생성 → 품질 게이트 → 썸네일 → content/posts/*.json
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { trendsTH, newsTopicTH, nicheCandidates, koreaCandidates, suggestions, searchNews, fetchArticleText, similarity, jaccard, resolveGoogleNewsUrl } from './lib/sources.mjs';
import { writeArticle, qualityCheck, normalize, polish, FatalError, QuotaExhausted } from './lib/writer.mjs';

// 좋은 모델을 쓸 검색량 기준 (Google Trends approx_traffic)
const PREMIUM_TRAFFIC = Number(process.env.PREMIUM_TRAFFIC || 10000);
// 다른 매체 기사를 모아 싣는 사이트 → "원 보도" 출처로 치지 않음
const AGGREGATOR = /line today|teenee|msn|yahoo|google|dek-d|kapook|sanook|naver|daum|nate|zum/i;
// 사생활·사건 관련 단어 (헤드라인 기준). 이런 주제는 원 보도 언론사 2곳 이상일 때만 작성
const SENSITIVE = /เลิกรา|เลิกกัน|หย่า|นอกใจ|มือที่สาม|ทะเลาะ|ชีวิตคู่|ตั้งครรภ์|ตั้งท้อง|แท้ง|ป่วยหนัก|มะเร็ง|เสียชีวิต|ดับสลด|คดี|จับกุม|ฟ้อง|ยาเสพติด|ทำร้าย|ข่มขืน|อนาจาร|แฉ|ด่ากราด|ทวงหนี้|หนี้สิน/;
// 한국어 헤드라인용 민감 주제
const SENSITIVE_KO = /열애|결별|이혼|불륜|임신|사망|별세|숨진|투병|백혈병|암 진단|건강이상|폭로|학폭|음주운전|마약|고소|소송|구속|체포|성추행|성폭|사생활|탈세|갑질/;
// K-연예 목표 비중 (최근 24시간 발행 글 중). 미달이면 K 후보를 앞에 배치
const KR_SHARE = Number(process.env.KR_SHARE || 0.35);
const KR_CAT = 'K-บันเทิง';
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
const CAT_COLOR = { 'บันเทิง': '#e11d48', 'ซีรีส์/หนัง': '#7c3aed', 'โซเชียล/ไวรัล': '#0ea5e9', 'ข่าวทั่วไป': '#475569', 'กีฬา': '#16a34a', 'ไลฟ์สไตล์': '#f59e0b', 'K-บันเทิง': '#0047a0' };

// 이미 시도했다 거절된 키워드는 24시간 동안 재시도 안 함 (무료 쿼터 절약)
const REJECT_FILE = path.join(CACHE, 'rejected.json');
const rejected = fs.existsSync(REJECT_FILE) ? JSON.parse(fs.readFileSync(REJECT_FILE, 'utf8')) : {};
for (const [k, t] of Object.entries(rejected)) if (Date.now() - t > 864e5) delete rejected[k];
const saveRejected = () => fs.writeFileSync(REJECT_FILE, JSON.stringify(rejected));

// 깨진 JSON 하나 때문에 전체 실행이 죽지 않도록 개별 try/catch
const existing = fs.readdirSync(POSTS).filter((f) => f.endsWith('.json') && !f.startsWith('demo-')) // 데모 글은 예산/중복 계산에서 제외
  .flatMap((f) => { try { return [JSON.parse(fs.readFileSync(path.join(POSTS, f), 'utf8'))]; } catch { console.warn('skip corrupt post file:', f); return []; } });
const recent = existing.filter((p) => Date.now() - Date.parse(p.createdAt) < 3 * 864e5)
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // 최신순 (LLM 중복 확인에 최신 제목이 들어가도록)
const publishedToday = existing.filter((p) => Date.now() - Date.parse(p.createdAt) < 864e5).length;
let budget = Math.min(MAX_PER_RUN, MAX_PER_DAY - publishedToday);
// 실행당 LLM 호출 상한: 거부가 이어져도 무료 한도를 한 번에 다 쓰지 않게
const MAX_ATTEMPTS = Number(process.env.MAX_ATTEMPTS || MAX_PER_RUN * 3);
let attempts = 0;

const reject = (kw) => { rejected[kw.toLowerCase()] = Date.now(); };
const isDup = (kw) => {
  const k = kw.toLowerCase();
  return Object.keys(rejected).some((r) => r === k || similarity(r, k) >= 0.7) ||
    recent.some((p) => p.keyword.toLowerCase() === k || similarity(kw, p.keyword) >= 0.7 || jaccard(kw, p.title) >= 0.6);
};
// 임시 파일에 쓰고 이름 변경 → 중간에 끊겨도 반쪽짜리 JSON 이 남지 않음
const writeAtomic = (file, data) => { fs.writeFileSync(file + '.tmp', data); fs.renameSync(file + '.tmp', file); };

async function gather() {
  const results = await Promise.allSettled([trendsTH(), newsTopicTH('ENTERTAINMENT'), nicheCandidates(), koreaCandidates()]);
  results.filter((r) => r.status === 'rejected').forEach((r) => console.warn('source failed:', r.reason?.message));
  const [trends = [], ent = [], niche = [], korea = []] = results.map((r) => (r.status === 'fulfilled' ? r.value : []));
  // 검색량 큰 트렌드 우선, 연예 헤드라인을 사이사이에 섞어 니치 커버. 가십 키워드 검색 결과는 뒤에 보충
  trends.sort((a, b) => b.traffic - a.traffic);
  const merged = [];
  for (let i = 0; i < Math.max(trends.length, ent.length); i++) {
    if (trends[i]) merged.push(trends[i]);
    if (ent[i]) merged.push(ent[i]);
  }
  merged.push(...niche);
  // K-연예 비중 맞추기: 최근 24시간 K 글 비율이 목표 미만이면 K 후보를 한 칸 걸러 앞쪽에 끼움, 이상이면 맨 뒤
  const today = existing.filter((p) => Date.now() - Date.parse(p.createdAt) < 864e5);
  const kShare = today.length ? today.filter((p) => p.category === KR_CAT).length / today.length : 0;
  console.log(`korea: ${korea.length} candidates, share ${Math.round(kShare * 100)}% (target ${Math.round(KR_SHARE * 100)}%)`);
  if (kShare < KR_SHARE) for (let i = 0; i < korea.length; i++) merged.splice(Math.min(i * 2, merged.length), 0, korea[i]);
  else merged.push(...korea);
  const out = [];
  for (const c of merged) if (!isDup(c.keyword) && !out.some((o) => similarity(o.keyword, c.keyword) >= 0.7)) out.push(c);
  return out;
}

async function buildFacts(c) {
  const more = await searchNews(c.query || c.keyword, 8, c.lang || 'th');
  const seen = new Set();
  const news = [...c.news, ...more].filter((n) => n.title && !seen.has(n.title) && seen.add(n.title)).slice(0, 8);
  // 구글 뉴스 래퍼 링크 → 실제 언론사 주소 (상위 4개). 본문·사진을 가져오고 출처 링크도 원문 주소로 표시됨
  await Promise.all(news.slice(0, 4).map(async (n) => { n.url = await resolveGoogleNewsUrl(n.url); }));
  // 원문 URL(직접 링크)이 있는 상위 3개 기사 본문을 근거로 추가
  const bodies = await Promise.all(news.filter((n) => n.url && !n.url.includes('news.google.com')).slice(0, 3).map((n) => fetchArticleText(n.url)));
  const facts = [
    ...news.map((n, i) => `[${i + 1}] ${n.source || 'ไม่ระบุ'}: ${n.title}${n.snippet ? `\n${n.snippet}` : ''}`),
    ...bodies.filter((b) => b.text).map((b, i) => `\n[เนื้อหาจากแหล่งข่าว ${i + 1}]\n${b.text}`),
  ].join('\n');
  // og:image ของต้นฉบับมักคมชัดที่สุด → ลองก่อน แล้วค่อยภาพจาก Trends
  const direct = news.filter((n) => n.url && !n.url.includes('news.google.com')).slice(0, 3);
  const images = [
    ...bodies.map((b, i) => ({ url: b.image, credit: direct[i]?.source })),
    { url: c.picture, credit: c.pictureSource },
    ...news.map((n) => ({ url: n.picture, credit: n.source })),
  ].filter((x) => x.url && process.env.USE_SOURCE_IMAGES !== 'false' && c.lang !== 'ko'); // 한국 매체 사진은 저작권 관리가 엄격 → 자체 썸네일만 // false → ใช้ภาพปกไล่สี+ข้อความเท่านั้น
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
    if (attempts >= MAX_ATTEMPTS) { console.log(`\n⏸ 실행당 LLM 호출 상한(${MAX_ATTEMPTS}) 도달 → 다음 실행에서 계속`); break; }
    console.log(`\n▶ ${c.keyword} [${c.origin}] traffic=${c.traffic}`);
    try {
      const f = await buildFacts(c);
      if (f.richness < 3) { console.log('  skip: not enough sources'); reject(c.keyword); continue; }
      // 출처 기준: 서로 다른 언론사 2곳 이상. 사생활·사건 주제는 "원 보도" 언론사 2곳 이상 (모음 사이트 제외)
      //  → 출처 하나짜리 가십(명예훼손 위험 최대)을 LLM 호출 전에 걸러 한도도 절약
      const outlets = [...new Set(f.news.map((n) => String(n.source || '').toLowerCase().replace(/^www\.|\.(co\.th|com|net|th)$/g, '').trim()).filter(Boolean))];
      const original = outlets.filter((s) => !AGGREGATOR.test(s));
      const headlineText = [c.keyword, ...f.news.map((n) => n.title)].join(' ');
      if (outlets.length < 2) { console.log(`  skip: single source (${outlets.join(',')})`); reject(c.keyword); continue; }
      if ((SENSITIVE.test(headlineText) || SENSITIVE_KO.test(headlineText)) && original.length < 2) { console.log(`  skip: sensitive topic needs 2+ original outlets (${original.join(',') || 'none'})`); reject(c.keyword); continue; }
      if (DRY) { console.log(f.facts.slice(0, 800)); budget--; continue; }

      attempts++;
      // 롱테일: 이 주제로 사람들이 실제 검색하는 말 (구글 자동완성)
      // 한국어 헤드라인은 태국 자동완성에 의미가 없음 → 건너뜀 (태국어 표기는 기사 작성 후 태그로 형성)
      const searchTerms = c.lang === 'ko' ? [] : [...new Set([...(await suggestions(c.query || c.keyword)), ...(c.query && c.query !== c.keyword ? await suggestions(c.keyword) : [])])].slice(0, 12);
      if (searchTerms.length) console.log(`  search terms: ${searchTerms.slice(0, 5).join(' | ')}`);
      // 검색량 큰 주제만 좋은 모델(하루 한도 작음) 우선 사용
      const premium = (c.traffic || 0) >= PREMIUM_TRAFFIC;
      const w = await writeArticle(c, f.facts, MODEL, recent.filter((p) => Date.now() - Date.parse(p.createdAt) < 2 * 864e5).slice(0, 40).map((p) => p.title), searchTerms, { premium });
      // AI 티 자동 교정: 오타(자음 3연속), 교훈형 마무리 문단 제거
      const { article: raw, removedClosers } = polish(w.article);
      const q = qualityCheck(raw, w.format);
      console.log(`  model: ${w.model}${premium ? ' (premium)' : ''} | format: ${w.format}${removedClosers ? ` | removed ${removedClosers} cliché closer` : ''}`);
      if (!q.ok) { console.log('  rejected:', q.problems.join('; ')); reject(c.keyword); continue; }
      const a = normalize(raw);
      if (c.kr) a.category = KR_CAT;
      if (recent.some((p) => jaccard(a.title, p.title) >= 0.6)) { console.log('  skip: duplicate story'); reject(c.keyword); continue; }

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
        // 허브 페이지는 태그 기준 → 핵심 인물/작품 이름을 태그 앞쪽에 합쳐 같은 대상끼리 묶이게
        tags: [...new Set([...a.entities.map((e) => e.name.trim()), ...a.tags])].slice(0, 7),
        entities: a.entities,
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
        format: w.format,
        ...(c.lang === 'ko' ? { origin: 'kr' } : {}),
        model: w.model,
        sources: f.news.slice(0, 6).map(({ title, url, source }) => ({ title, url, source })),
      };
      writeAtomic(path.join(POSTS, `${slug}.json`), JSON.stringify(post, null, 2));
      recent.push(post);
      newUrls.push(`/post/${slug}/`);
      console.log(`  ✅ published (${q.words} words): ${a.title}`);
      budget--;
    } catch (e) {
      console.error('  ❌ failed:', e.message);
      if (e instanceof FatalError) { fatal = e; break; }
      if (e instanceof QuotaExhausted) { console.log('  ⏸ ' + e.message + ' → 이번 실행 종료, 다음 실행에서 재시도'); break; }
      reject(c.keyword); // 안전 차단·스키마 오류 등: 매시간 같은 주제에 한도를 다시 쓰지 않게 24시간 제외
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
