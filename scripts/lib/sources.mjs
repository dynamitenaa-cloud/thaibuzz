// 소스: Google Trends TH 실시간 급상승 + Google News TH 연예 헤드라인 → Google News 검색으로 근거 보강
import { XMLParser } from 'fast-xml-parser';

const UA = { 'user-agent': 'Mozilla/5.0 (compatible; ThaiBuzzBot/1.0; +https://github.com)' };
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@' });
const arr = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const text = (x) => (typeof x === 'object' && x ? x['#text'] ?? '' : x ?? '').toString().trim();

async function getXml(url) {
  const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${url} → ${r.status}`);
  return parser.parse(await r.text());
}

const parseTraffic = (s) => {
  const m = String(s || '').replace(/,/g, '').match(/([\d.]+)\s*([KkMm]?)/);
  if (!m) return 0;
  return Math.round(Number(m[1]) * (m[2].toLowerCase() === 'k' ? 1e3 : m[2].toLowerCase() === 'm' ? 1e6 : 1));
};

const ENT = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
  hellip: '…', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', bull: '•', middot: '·', copy: '©', reg: '®', trade: '™',
};
export const decode = (s) =>
  String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, k) => ENT[k.toLowerCase()] ?? m);
const stripTags = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

export async function trendsTH() {
  const xml = await getXml('https://trends.google.com/trending/rss?geo=TH');
  return arr(xml.rss?.channel?.item).map((it) => ({
    origin: 'trends',
    keyword: text(it.title),
    traffic: parseTraffic(it['ht:approx_traffic']),
    picture: text(it['ht:picture']),
    pictureSource: text(it['ht:picture_source']),
    news: arr(it['ht:news_item']).map((n) => ({
      title: stripTags(n['ht:news_item_title']),
      url: text(n['ht:news_item_url']),
      source: text(n['ht:news_item_source']),
      snippet: stripTags(n['ht:news_item_snippet']),
      picture: text(n['ht:news_item_picture']),
    })),
  }));
}

// Google News 지역/언어 파라미터
const GN = { th: 'hl=th&gl=TH&ceid=TH:th', ko: 'hl=ko&gl=KR&ceid=KR:ko' };

// Google News: "หัวข้อ - สำนักข่าว"
const splitTitle = (t) => {
  const i = t.lastIndexOf(' - ');
  return i > 0 ? { title: t.slice(0, i), source: t.slice(i + 3) } : { title: t, source: '' };
};

export async function newsTopicTH(topic = 'ENTERTAINMENT') {
  const xml = await getXml(`https://news.google.com/rss/headlines/section/topic/${topic}?hl=th&gl=TH&ceid=TH:th`);
  return arr(xml.rss?.channel?.item)
    .filter((it) => Date.now() - Date.parse(text(it.pubDate)) < 24 * 3.6e6)
    .map((it) => {
      const { title, source } = splitTitle(decode(text(it.title)));
      // description = <ol><li><a href>หัวข้อ</a><font>สำนักข่าว</font></li>…</ol> (ข่าวเดียวกันจากหลายสำนัก)
      const cluster = [...String(it.description || '').matchAll(/<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>(?:&nbsp;|\s)*<font[^>]*>([\s\S]*?)<\/font>/g)].map((m) => ({
        title: stripTags(m[2]), url: m[1], source: stripTags(m[3]), snippet: '', picture: '',
      }));
      const news = cluster.length ? cluster : [{ title, url: text(it.link), source: text(it.source) || source, snippet: '', picture: '' }];
      return { origin: `gnews:${topic}`, keyword: title, query: shortQuery(title), traffic: 0, picture: '', pictureSource: '', news };
    });
}

// พาดหัวยาว → คำค้นสั้น (ตัดเครื่องหมาย/คำเชื่อม เอา ~6 คำแรก) เพื่อหาข่าวเดียวกันจากสำนักอื่น
// 태국어 제목은 구(phrase) 사이를 띄어쓰기로 구분 → 띄어쓰기 단위로 자르면 "ลิซ่า" 같은 이름이 쪼개지지 않음
// (단어 분할기로 자르면 사전에 없는 이름이 "ลิ ซ่า" 로 깨져 검색 정확도가 떨어짐)
export function shortQuery(title) {
  const chunks = title.replace(/["'“”‘’!?.,:;()[\]|]/g, ' ').split(/\s+/).filter(Boolean);
  let q = '';
  for (const c of chunks) {
    if ([...(q + ' ' + c)].length > 45) break;
    q = q ? `${q} ${c}` : c;
  }
  return q || chunks[0] || title;
}

// 후보 보충: 트렌드/연예 헤드라인만으로는 시간대에 따라 새 주제가 0~3개로 고갈됨 →
// 연예·가십 키워드로 최근 24시간 뉴스 검색. 키워드당 상위 몇 건만 (같은 사건 중복은 이후 단계에서 걸러짐)
export const NICHE_QUERIES = ['ดารา', 'ดราม่า', 'ซีรีส์', 'ศิลปิน', 'ไวรัล โซเชียล', 'นักแสดง'];
export async function nicheCandidates(queries = NICHE_QUERIES, perQuery = 4) {
  const lists = await Promise.allSettled(queries.map(async (q) => {
    const xml = await getXml(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:1d&hl=th&gl=TH&ceid=TH:th`);
    return arr(xml.rss?.channel?.item).slice(0, perQuery).map((it) => {
      const { title, source } = splitTitle(decode(text(it.title)));
      return { origin: `gnews:q=${q}`, keyword: title, query: shortQuery(title), traffic: 0, picture: '', pictureSource: '', news: [{ title, url: text(it.link), source: text(it.source) || source, snippet: '', picture: '' }] };
    });
  }));
  return lists.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

// ── 한국 × 태국: K-연예 후보 ──
// 1) 한국 원문(구글 뉴스 한국판): 태국 매체가 영어 기사를 거쳐 번역하기 전에 먼저 다룰 수 있음 (속도 우위)
//    - 태국 관련(태국인 멤버·방콕 공연) 검색을 앞에, 한국 연예 헤드라인은 뒤에
// 2) 태국어로 이미 화제인 K-연예 (태국 팬 관심이 검증된 주제)
// kr: true → K-บันเทิง 카테고리, lang: 'ko' → 근거 검색도 한국 뉴스에서
export const KR_QUERIES_KO = ['태국인 멤버', '블랙핑크 리사', '뱀뱀', '민니 아이들', '방콕 콘서트', '방콕 팬미팅', '아이돌 컴백', '넷플릭스 한국 드라마'];
// 연예가 아닌 것/게시물형 소스 걸러냄 (LLM 호출 전에 버려 한도 절약)
const KR_NOISE_TITLE = /운세|^\s*\[포토|\[화보\]|날씨|증시|주가|코스피|대통령|국회|의원|장관|부동산|몸매|힙라인|갈비뼈|각선미|노출;
const KR_NOISE_SOURCE = /facebook|weverse|instagram|youtube|x\.com|twitter|investing|vietnam\.vn|tiktok/i;
// 한국어 제목 → 짧은 검색어: 긴 인용구(발언)는 빼고 짧은 따옴표(작품명)는 유지, 앞 4어절
export function shortQueryKo(title) {
  const t = title
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/(['"‘“])([^'"’”]{13,})(['"’”])/g, ' ')
    .replace(/[‘’“”'"]/g, '')
    .replace(/\.{2,}|…|[!?,·|()]/g, ' ');
  const w = t.split(/\s+/).filter(Boolean);
  return w.slice(0, 4).join(' ') || shortQuery(title);
}
export const KR_QUERIES_TH = ['ไอดอลเกาหลี', 'ซีรีส์เกาหลี', 'คอนเสิร์ต เกาหลี กรุงเทพ', 'แฟนมีตติ้ง เกาหลี'];
const recentItems = (xml, n) => arr(xml.rss?.channel?.item).filter((it) => Date.now() - Date.parse(text(it.pubDate)) < 36 * 3.6e6).slice(0, n);
const toCand = (it, origin, lang) => {
  const { title, source } = splitTitle(decode(text(it.title)));
  const src = text(it.source) || source;
  if (KR_NOISE_SOURCE.test(src) || [...title].length > 140 || (lang === 'ko' && KR_NOISE_TITLE.test(title))) return null;
  return { origin, kr: true, lang, keyword: title, query: lang === 'ko' ? shortQueryKo(title) : shortQuery(title), traffic: 0, picture: '', pictureSource: '', news: [{ title, url: text(it.link), source: text(it.source) || source, snippet: '', picture: '' }] };
};
export async function koreaCandidates(perQuery = 3) {
  const jobs = [
    ...KR_QUERIES_KO.map((q) => getXml(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:1d&${GN.ko}`).then((x) => recentItems(x, perQuery).map((it) => toCand(it, `kr:q=${q}`, 'ko')))),
    getXml(`https://news.google.com/rss/headlines/section/topic/ENTERTAINMENT?${GN.ko}`).then((x) => recentItems(x, 8).map((it) => toCand(it, 'kr:ENT', 'ko'))),
    ...KR_QUERIES_TH.map((q) => getXml(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:1d&${GN.th}`).then((x) => recentItems(x, perQuery).map((it) => toCand(it, `kr:th=${q}`, 'th')))),
  ];
  const lists = await Promise.allSettled(jobs);
  lists.filter((r) => r.status === 'rejected').forEach((r) => console.warn('korea source failed:', r.reason?.message));
  return lists.flatMap((r) => (r.status === 'fulfilled' ? r.value : [])).filter(Boolean);
}

// 롱테일: 구글 자동완성 = 태국 사람들이 실제로 치는 검색어 (예: "ไบร์ท วชิรวิชญ์ แฟน", "ลิซ่าอายุ")
// 기사 FAQ/소제목에 반영해 경쟁이 약한 롱테일 검색을 노림. 실패하면 빈 배열 (기사 작성은 계속)
export async function suggestions(q, limit = 10) {
  try {
    const r = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&hl=th&gl=th&q=${encodeURIComponent(q)}`, {
      headers: { 'user-agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000),
    });
    const j = JSON.parse(await r.text());
    return (j[1] || []).filter((s) => s && s.toLowerCase() !== q.toLowerCase()).slice(0, limit);
  } catch {
    return [];
  }
}

// คีย์เวิร์ดเดียว → ข่าวที่เกี่ยวข้องภายใน 3 วัน (หลายแหล่ง = ข้อเท็จจริงแน่นขึ้น)
export async function searchNews(q, limit = 8, lang = 'th') {
  try {
    const xml = await getXml(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:3d&${GN[lang] || GN.th}`);
    return arr(xml.rss?.channel?.item).slice(0, limit).map((it) => {
      const { title, source } = splitTitle(text(it.title));
      return { title, url: text(it.link), source: text(it.source) || source, snippet: '', picture: '', pubDate: text(it.pubDate) };
    });
  } catch {
    return [];
  }
}

// ดึงเนื้อหาหลักจากหน้าข่าวต้นทาง (meta description + ย่อหน้า) เพื่อใช้เป็นข้อเท็จจริง
export async function fetchArticleText(url, max = 2500) {
  if (!url || url.includes('news.google.com')) return { text: '', image: '' };
  try {
    const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000), redirect: 'follow' });
    if (!r.ok || !(r.headers.get('content-type') || '').includes('html')) return { text: '', image: '' };
    const html = (await r.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, '');
    // <meta> 속성 순서(property 먼저/content 먼저) 둘 다 지원, 값의 HTML 엔티티(&amp; 등) 복원
    const meta = (p) => {
      for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
        const key = tag.match(/\b(?:property|name)\s*=\s*(["'])(.*?)\1/i)?.[2];
        if (key?.toLowerCase() !== p) continue;
        const val = tag.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2];
        if (val) return decode(val).trim();
      }
      return '';
    };
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => stripTags(m[1])).filter((t) => t.length > 40);
    const body = [stripTags(meta('og:description') || meta('description')), ...paras].join('\n');
    return { text: body.slice(0, max), image: meta('og:image') };
  } catch {
    return { text: '', image: '' };
  }
}

// ความคล้ายของหัวข้อ (กันเขียนเรื่องซ้ำ)
const seg = new Intl.Segmenter('th', { granularity: 'word' });
export const tokens = (s) => new Set([...seg.segment(String(s).toLowerCase())].filter((x) => x.isWordLike && x.segment.length > 1).map((x) => x.segment));
export function similarity(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  // 공통 단어가 1개뿐이면 무시: "หวย" 하나로 복권 관련 모든 헤드라인이 중복 처리되던 문제 방지
  if (n < 2) return 0;
  return n / Math.min(A.size, B.size);
}

// Jaccard: ใช้เทียบพาดหัวกับพาดหัว (คำทั่วไปที่ซ้ำกันไม่ทำให้คะแนนสูงเกินจริง)
export function jaccard(a, b) {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  return n / (A.size + B.size - n);
}

// Google News RSS 링크(news.google.com/rss/articles/...)는 리다이렉트 래퍼라 본문/사진을 못 가져온다.
// 페이지의 서명값으로 batchexecute 를 호출해 실제 언론사 URL 을 얻는다. 비공식 방식이라 실패하면 원래 링크 유지.
const GN_UA = { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36' };
export async function resolveGoogleNewsUrl(link) {
  if (!link || !link.includes('news.google.com/rss/articles/')) return link;
  try {
    const id = new URL(link).pathname.split('/').pop();
    const page = await (await fetch(`https://news.google.com/rss/articles/${id}?hl=th&gl=TH&ceid=TH:th`, { headers: GN_UA, signal: AbortSignal.timeout(12000) })).text();
    const sg = page.match(/data-n-a-sg="([^"]+)"/)?.[1], ts = page.match(/data-n-a-ts="([^"]+)"/)?.[1];
    if (!sg || !ts) return link;
    const inner = JSON.stringify(['garturlreq', [['X', 'X', ['X', 'X'], null, null, 1, 1, 'US:en', null, 1, null, null, null, null, null, 0, 1], 'X', 'X', 1, [1, 1, 1], 1, 1, null, 0, 0, null, 0], id, ts, sg]);
    const r = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST', headers: { ...GN_UA, 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: 'f.req=' + encodeURIComponent(JSON.stringify([[['Fbv4je', inner, null, 'generic']]])), signal: AbortSignal.timeout(12000),
    });
    const url = JSON.parse(JSON.parse((await r.text()).split('\n\n')[1])[0][2])[1];
    return /^https?:\/\//.test(url) ? url : link;
  } catch { return link; }
}
