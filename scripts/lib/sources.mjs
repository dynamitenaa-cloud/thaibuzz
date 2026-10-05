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

const ENT = { nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>' };
export const decode = (s) =>
  String(s || '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(nbsp|amp|quot|apos|lt|gt);/g, (_, k) => ENT[k]);
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
const STOP = new Set(['ที่', 'และ', 'ของ', 'ใน', 'กับ', 'ให้', 'ได้', 'เป็น', 'จะ', 'นี้', 'แล้ว', 'ว่า', 'การ', 'มี', 'ไม่', 'ก็', 'หลัง', 'ถึง', 'เผย', 'สุด']);
export function shortQuery(title) {
  const words = [...new Intl.Segmenter('th', { granularity: 'word' }).segment(title.replace(/["'“”‘’!?.,:;()[\]|]/g, ' '))]
    .filter((x) => x.isWordLike && !STOP.has(x.segment))
    .map((x) => x.segment);
  return words.slice(0, 6).join(' ');
}

// คีย์เวิร์ดเดียว → ข่าวที่เกี่ยวข้องภายใน 3 วัน (หลายแหล่ง = ข้อเท็จจริงแน่นขึ้น)
export async function searchNews(q, limit = 8) {
  try {
    const xml = await getXml(`https://news.google.com/rss/search?q=${encodeURIComponent(q)}+when:3d&hl=th&gl=TH&ceid=TH:th`);
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
    const meta = (p) => html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]+content=["']([^"']+)`, 'i'))?.[1] ?? '';
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
