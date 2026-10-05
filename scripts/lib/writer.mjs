// LLM 기사 작성 + 품질 게이트
import fs from 'node:fs';
import { generateText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const CATEGORY_NAMES = ['บันเทิง', 'ซีรีส์/หนัง', 'โซเชียล/ไวรัล', 'ข่าวทั่วไป', 'กีฬา', 'ไลฟ์สไตล์'];

const Article = z.object({
  publishable: z.boolean().describe('true เฉพาะเมื่อข้อมูลเพียงพอ ถูกต้อง และปลอดภัยตามกฎ'),
  duplicateOf: z.string().describe('ถ้าเรื่องนี้คือเหตุการณ์/ประเด็นเดียวกับบทความที่เผยแพร่แล้วในรายการ "บทความล่าสุดของเรา" ให้ใส่หัวข้อของบทความนั้นตรงตัว ถ้าไม่ซ้ำให้เป็นสตริงว่าง'),
  rejectReason: z.string().describe('เหตุผลหากไม่เผยแพร่ ถ้าเผยแพร่ให้เป็นสตริงว่าง'),
  title: z.string().describe('พาดหัวภาษาไทย 40-90 ตัวอักษร ดึงดูดแต่ตรงกับเนื้อหา'),
  excerpt: z.string().describe('คำโปรย/meta description 120-160 ตัวอักษร'),
  thumbText: z.string().describe('ข้อความบนภาพปก 12-36 ตัวอักษร กระชับ ชวนคลิก แต่ไม่บิดเบือน'),
  summary: z.array(z.string()).describe('สรุปประเด็นสำคัญ 3 ข้อ ข้อละ 1 ประโยค'),
  sections: z
    .array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) }))
    .describe('3-5 หัวข้อย่อย แต่ละหัวข้อ 1-3 ย่อหน้า ย่อหน้าละ 2-4 ประโยค'),
  timeline: z.array(z.object({ when: z.string(), what: z.string() })).describe('ลำดับเหตุการณ์ (ถ้ามีวันที่/ลำดับชัดเจนในแหล่งข่าว) ไม่มีให้เป็นอาร์เรย์ว่าง'),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).describe('0-4 คำถามที่คนค้นหาจริง (ใช้ "คำค้นยอดนิยม" ที่ให้มาเป็นแนวทาง) ตอบจากข้อเท็จจริงในแหล่งข่าวเท่านั้น ถ้าแหล่งข่าวไม่มีคำตอบ ห้ามใส่คำถามนั้น'),
  entities: z.array(z.object({ name: z.string(), type: z.enum(['person', 'work', 'group', 'other']) })).describe('1-4 บุคคล/ผลงาน(ซีรีส์ หนัง เพลง)/วง/ทีม ที่เป็นหัวใจของข่าว ใช้ชื่อที่คนไทยค้นหาบ่อยที่สุด'),
  tags: z.array(z.string()).describe('4-6 แท็กแบบเจาะจง: ชื่อคนดัง ชื่อซีรีส์/ผลงาน ชื่อวง/ทีม ชื่องานหรือเหตุการณ์ (ตามที่คนค้นหา) ห้ามใช้แท็กกว้าง ๆ เช่น ข่าวบันเทิง ไวรัล ดารา ซีรีส์'),
  category: z.enum(CATEGORY_NAMES),
  imageAlt: z.string().describe('คำอธิบายภาพปกสั้น ๆ สำหรับ alt text'),
});

const SYSTEM = `คุณคือบรรณาธิการอาวุโสของเว็บข่าวบันเทิงและเทรนด์ภาษาไทย เขียนสไตล์อ่านง่าย กระชับ เป็นกันเอง แบบสื่อออนไลน์ไทยชั้นนำ

กฎเหล็ก (ห้ามละเมิด):
1. ใช้เฉพาะข้อเท็จจริงที่ปรากฏใน "ข้อมูลจากแหล่งข่าว" ห้ามแต่งตัวเลข ชื่อ คำพูด วันที่ หรือเหตุการณ์เพิ่มเอง
2. ข่าวลือ/ความสัมพันธ์/ดราม่า/ข้อกล่าวหา ของบุคคลจริง → ระบุว่า "ตามรายงานของ [สำนักข่าว]" หรือ "ยังไม่มีการยืนยัน" ห้ามสรุปว่าเป็นความจริง
3. ตั้ง publishable=false หาก: เกี่ยวกับผู้เยาว์ในเชิงอื้อฉาว, การเสียชีวิต/อาการป่วยที่ยังไม่ยืนยัน, คดีอาชญากรรมที่ระบุตัวผู้ต้องสงสัยซึ่งเป็นบุคคลธรรมดา, ประเด็นการเมืองที่ยั่วยุ, เนื้อหาทางเพศ, หรือข้อมูลน้อยเกินกว่าจะเขียนให้มีสาระ
4. พาดหัวต้องชวนอ่านแต่ "ตรงกับเนื้อหา" ห้ามหลอกคลิก ห้ามใช้คำว่า "ช็อก" หากเนื้อหาไม่ได้น่าตกใจ
5. เพิ่มคุณค่าให้ผู้อ่าน: อธิบายที่มาของประเด็น บริบท ว่าทำไมคนถึงพูดถึง และสิ่งที่ควรติดตามต่อ
6. ห้ามคัดลอกประโยคจากแหล่งข่าวยาวเกิน 10 คำ ให้เรียบเรียงใหม่ทั้งหมด
7. ไม่ต้องใส่ลิงก์หรือชื่อเว็บไซต์ของเราในเนื้อหา
8. ความยาวรวมทุกส่วนประมาณ 450-650 คำ: มี 4-5 หัวข้อย่อย แต่ละหัวข้อ 2 ย่อหน้า ย่อหน้าละ 3-4 ประโยค ขยายความด้วยบริบท ที่มาของประเด็น และมุมมองจากแหล่งข่าวต่าง ๆ (ต้องมาจากข้อเท็จจริงที่ให้เท่านั้น) ห้ามเขียนสั้นเกินไป`;

// 오류 분류
//  - FatalError: API 키/권한 문제 → 즉시 중단, 워크플로 실패 처리(알림 메일)
//  - QuotaExhausted: 사용 가능한 모든 모델의 무료 한도 소진 → 정상 종료, 다음 실행에서 재시도
export class FatalError extends Error {}
export class QuotaExhausted extends Error {}
const AUTH = /API key not valid|API_KEY_INVALID|permission denied|unauthorized|forbidden|PERMISSION_DENIED/i;
const QUOTA = /quota|RESOURCE_EXHAUSTED|\b429\b|rate.?limit|exceeded your current/i;
const GONE = /no longer available|is not found|not supported for generateContent|model.*not found/i;
const TRANSIENT = /high demand|overloaded|UNAVAILABLE|\b50[0234]\b|internal error|deadline|timed? ?out|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 사용 가능한 모델을 API 로 직접 조회 (모델명 단종/변경에 자동 대응).
// 순서: GEMINI_MODEL(지정 시) → flash-lite 계열(무료 한도 큼) → 나머지 flash. 이미지/음성/임베딩 등 제외
let chain = null, idx = 0;

// 한도 소진된 모델은 쿨다운 동안 건너뜀 (.cache 는 Actions 캐시로 실행 간 유지). 구글이 알려주는 "Please retry in 8h19m" 을 파싱
const COOL = '.cache/model-cooldown.json';
const readCool = () => { try { return JSON.parse(fs.readFileSync(COOL, 'utf8')); } catch { return {}; } };
// "retry in 8h19m7.6s" / "retry in 37.5s" / "retry in 2m" → ms. 못 읽으면 null
export function parseRetryMs(msg) {
  const m = String(msg).match(/retry in\s*(?:(\d+)h)?\s*(?:(\d+)m(?!s))?\s*(?:([\d.]+)s)?/i);
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return ((+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (parseFloat(m[3]) || 0)) * 1000;
}
function markCooldown(name, msg) {
  const ms = (parseRetryMs(msg) ?? 6 * 36e5) + 60e3;
  const c = readCool(); c[name] = Date.now() + ms;
  fs.mkdirSync('.cache', { recursive: true }); fs.writeFileSync(COOL, JSON.stringify(c));
}
export async function resolveModels() {
  const pinned = (process.env.GEMINI_MODEL || '').split(',').map((s) => s.trim()).filter(Boolean);
  let found = [];
  try {
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
      headers: { 'x-goog-api-key': process.env.GOOGLE_GENERATIVE_AI_API_KEY || '' },
      signal: AbortSignal.timeout(20000),
    });
    if (r.status === 400 || r.status === 401 || r.status === 403) throw new FatalError(`모델 목록 조회 실패 ${r.status} — API 키 확인`);
    if (r.ok) {
      const ids = (await r.json()).models
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((n) => /flash/.test(n) && !/image|tts|live|audio|embed|robotics|computer|thinking|exp\b|-latest/.test(n));
      const ver = (n) => (n.match(/(\d+(?:\.\d+)?)/)?.[1] ?? '0');
      const byNew = (a, b) => parseFloat(ver(b)) - parseFloat(ver(a)) || b.localeCompare(a);
      found = [...ids.filter((n) => /lite/.test(n)).sort(byNew), ...ids.filter((n) => !/lite/.test(n)).sort(byNew)];
    }
  } catch (e) { if (e instanceof FatalError) throw e; console.warn('모델 목록 조회 실패:', e.message); }
  const cool = readCool();
  const all = [...new Set([...pinned, ...found, 'gemini-3.8-flash'])];
  chain = all.filter((n) => !(cool[n] > Date.now()));
  const skipped = all.filter((n) => cool[n] > Date.now());
  if (skipped.length) console.log('쿨다운 중(한도 소진):', skipped.join(', '));
  if (!chain.length) throw new QuotaExhausted('모든 모델이 쿨다운 중 (무료 한도 소진)');
  console.log('model chain:', chain.slice(0, 6).join(' → '));
  return chain;
}

export async function writeArticle(c, facts, model, recentTitles = [], searchTerms = []) {
  if (!model && !chain) await resolveModels();
  const getModel = () => model ?? google(chain[idx]);
  // 의미 기반 중복 방지: 최근 발행 제목을 보여주고 같은 사건이면 스스로 거부하게 함 (단어 비교로는 영/태 혼용 중복을 못 잡음)
  const recentBlock = recentTitles.length
    ? 'บทความล่าสุดของเรา (ห้ามเขียนซ้ำเหตุการณ์เดียวกัน แม้จะใช้คีย์เวิร์ดหรือภาษาต่างกัน เช่น ชื่อทีมภาษาอังกฤษกับภาษาไทย):\n' +
      recentTitles.map((t) => `- ${t}`).join('\n') + '\n\n'
    : '';
  // 롱테일: 실제 검색어를 소제목/FAQ 방향으로만 제시. 출처에 없는 개인정보(나이·키·연애)는 절대 추측하지 않게 명시
  const searchBlock = searchTerms.length
    ? 'คำค้นยอดนิยมที่คนไทยพิมพ์ใน Google เกี่ยวกับเรื่องนี้ (ใช้เป็นแนวทางตั้งหัวข้อย่อยและ FAQ อย่างเป็นธรรมชาติ เฉพาะข้อที่แหล่งข่าวมีคำตอบ ห้ามเดาข้อมูลส่วนตัว เช่น อายุ ส่วนสูง แฟน ถ้าแหล่งข่าวไม่ได้ระบุ):\n' +
      searchTerms.map((t) => `- ${t}`).join('\n') + '\n\n'
    : '';
  const prompt = `คีย์เวิร์ดที่กำลังเป็นกระแสในไทย: "${c.keyword}"${c.traffic ? ` (ค้นหามากกว่า ${c.traffic.toLocaleString()} ครั้ง)` : ''}
วันที่ปัจจุบัน: ${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long' })}

ข้อมูลจากแหล่งข่าว:
${facts}

${searchBlock}${recentBlock}เขียนบทความตามกฎทั้งหมด (ถ้าซ้ำกับบทความข้างต้น → duplicateOf ใส่หัวข้อนั้น และ publishable=false)`;
  let lastErr, overload = 0;
  while (true) {
    try {
      const { output } = await generateText({ model: getModel(), system: SYSTEM, prompt, output: Output.object({ schema: Article }), temperature: 0.6, maxRetries: 0 });
      return output;
    } catch (e) {
      lastErr = e;
      const msg = String(e?.message);
      if (AUTH.test(msg)) throw new FatalError(msg);
      const retryMs = parseRetryMs(msg);
      // 분당 한도(짧은 대기 안내) → 모델을 막지 않고 그만큼만 기다렸다가 같은 모델로 재시도
      if (QUOTA.test(msg) && retryMs !== null && retryMs <= 90e3 && ++overload <= 2) {
        console.warn(`  분당 한도 → ${Math.ceil(retryMs / 1000)}s 대기 후 재시도`);
        await sleep(retryMs + 1000);
        continue;
      }
      if (!model && (QUOTA.test(msg) || GONE.test(msg))) {
        // 일일 한도 소진/단종 → 다음 모델로 전환 (이 글 요청은 처음부터 다시)
        console.warn(`  model ${chain[idx]} 사용 불가 (${QUOTA.test(msg) ? '한도 소진' : '단종'}) → 다음 모델`);
        markCooldown(chain[idx], QUOTA.test(msg) ? msg : 'retry in 24h');
        if (++idx >= chain.length) throw new QuotaExhausted('모든 모델의 무료 한도가 소진됨');
        continue;
      }
      // 재시도는 일시적 오류(과부하·5xx·네트워크)만. 안전 차단·스키마 불일치 등은 다시 해도 같은 결과라 한도만 낭비
      if (!TRANSIENT.test(msg) || ++overload > 2) throw lastErr;
      const wait = 8000 * overload;
      console.warn(`  retry ${overload} in ${wait / 1000}s: ${msg.slice(0, 120)}`);
      await sleep(wait);
    }
  }
}

const len = (s) => [...(s || '')].length;
const seg = new Intl.Segmenter('th', { granularity: 'word' });
const words = (s) => [...seg.segment(s)].filter((x) => x.isWordLike).length;

// 품질 게이트: 통과 못 하면 발행 안 함 (얇은 글은 사이트 전체 평가를 깎음)
export function qualityCheck(a) {
  const problems = [];
  if (a.duplicateOf?.trim()) problems.push(`duplicate of: ${a.duplicateOf.slice(0, 60)}`);
  else if (!a.publishable) problems.push(`not publishable: ${a.rejectReason}`);
  if (len(a.title) < 20 || len(a.title) > 130) problems.push(`title length ${len(a.title)}`);
  if (a.summary.length < 3) problems.push('summary < 3');
  if (a.sections.length < 3) problems.push('sections < 3');
  const total = words([...a.summary, ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs])].join(' '));
  if (total < 300) problems.push(`too short: ${total} words`);
  if (a.tags.length < 3) problems.push('tags < 3');
  return { ok: problems.length === 0, problems, words: total };
}

export function normalize(a) {
  return {
    ...a,
    summary: a.summary.slice(0, 3),
    sections: a.sections.slice(0, 6).map((s) => ({ heading: s.heading.trim(), paragraphs: s.paragraphs.map((p) => p.trim()).filter(Boolean) })),
    tags: [...new Set(a.tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean))].slice(0, 6),
    faq: a.faq.slice(0, 4),
    entities: (a.entities || []).filter((e) => e.name?.trim()).slice(0, 4),
    timeline: a.timeline.slice(0, 8),
  };
}
