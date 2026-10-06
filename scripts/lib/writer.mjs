// LLM 기사 작성 + 품질 게이트
import fs from 'node:fs';
import { generateText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const CATEGORY_NAMES = ['บันเทิง', 'ซีรีส์/หนัง', 'โซเชียล/ไวรัล', 'ข่าวทั่วไป', 'กีฬา', 'ไลฟ์สไตล์', 'K-บันเทิง'];

const Article = z.object({
  publishable: z.boolean().describe('true เฉพาะเมื่อข้อมูลเพียงพอ ถูกต้อง และปลอดภัยตามกฎ'),
  duplicateOf: z.string().describe('ถ้าเรื่องนี้คือเหตุการณ์/ประเด็นเดียวกับบทความที่เผยแพร่แล้วในรายการ "บทความล่าสุดของเรา" ให้ใส่หัวข้อของบทความนั้นตรงตัว ถ้าไม่ซ้ำให้เป็นสตริงว่าง'),
  rejectReason: z.string().describe('เหตุผลหากไม่เผยแพร่ ถ้าเผยแพร่ให้เป็นสตริงว่าง'),
  title: z.string().describe('พาดหัวภาษาไทย 40-90 ตัวอักษร ดึงดูดแต่ตรงกับเนื้อหา'),
  excerpt: z.string().describe('คำโปรย 120-160 ตัวอักษร เปิดด้วยข้อเท็จจริงที่น่าสนใจที่สุดของเรื่อง'),
  thumbText: z.string().describe('ข้อความบนภาพปก 12-36 ตัวอักษร กระชับ ชวนคลิก แต่ไม่บิดเบือน'),
  summary: z.array(z.string()).describe('สรุปประเด็นสำคัญ 2-4 ข้อ ข้อละ 1 ประโยค (จำนวนตามความเหมาะสมของเรื่อง)'),
  sections: z
    .array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) }))
    .describe('หัวข้อย่อยตามรูปแบบที่กำหนด แต่ละหัวข้อมีจำนวนย่อหน้าไม่เท่ากัน (1-4) และย่อหน้ายาวสั้นต่างกัน'),
  timeline: z.array(z.object({ when: z.string(), what: z.string() })).describe('ลำดับเหตุการณ์ (เฉพาะเมื่อแหล่งข่าวมีวันที่/ลำดับชัดเจน) ไม่มีให้เป็นอาร์เรย์ว่าง'),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).describe('คำถามที่คนค้นหาจริง (ใช้ "คำค้นยอดนิยม" เป็นแนวทาง) จำนวนตามรูปแบบที่กำหนด ตอบจากข้อเท็จจริงในแหล่งข่าวเท่านั้น ถ้าแหล่งข่าวไม่มีคำตอบ ห้ามใส่คำถามนั้น'),
  entities: z.array(z.object({ name: z.string(), type: z.enum(['person', 'work', 'group', 'other']) })).describe('1-4 บุคคล/ผลงาน(ซีรีส์ หนัง เพลง)/วง/ทีม ที่เป็นหัวใจของข่าว ใช้ชื่อที่คนไทยค้นหาบ่อยที่สุด'),
  tags: z.array(z.string()).describe('4-6 แท็กแบบเจาะจง: ชื่อคนดัง ชื่อซีรีส์/ผลงาน ชื่อวง/ทีม ชื่องานหรือเหตุการณ์ (ตามที่คนค้นหา) ห้ามใช้แท็กกว้าง ๆ เช่น ข่าวบันเทิง ไวรัล ดารา ซีรีส์'),
  category: z.enum(CATEGORY_NAMES),
  imageAlt: z.string().describe('คำอธิบายภาพปกสั้น ๆ สำหรับ alt text'),
});

const SYSTEM = `คุณคือนักข่าวบันเทิงและเทรนด์ภาษาไทยที่มีประสบการณ์ เขียนแบบคนจริง อ่านง่าย กระชับ เป็นกันเอง เหมือนสื่อออนไลน์ไทยชั้นนำ ไม่ใช่สำนวนหุ่นยนต์

กฎเหล็ก (ห้ามละเมิด):
1. ใช้เฉพาะข้อเท็จจริงที่ปรากฏใน "ข้อมูลจากแหล่งข่าว" ห้ามแต่งตัวเลข ชื่อ คำพูด วันที่ หรือเหตุการณ์เพิ่มเอง สะกดชื่อบุคคลให้ตรงกับแหล่งข่าวทุกตัวอักษร
2. ข่าวลือ/ความสัมพันธ์/ดราม่า/ข้อกล่าวหาของบุคคลจริง: บอกให้ชัดว่าใครเป็นผู้ให้ข้อมูล และถ้ายังไม่ยืนยันให้บอกตรง ๆ ห้ามสรุปเองว่าเป็นความจริง
3. ตั้ง publishable=false หาก: เกี่ยวกับผู้เยาว์ในเชิงอื้อฉาว, การเสียชีวิต/อาการป่วยที่ยังไม่ยืนยัน, คดีอาชญากรรมที่ระบุตัวผู้ต้องสงสัยซึ่งเป็นบุคคลธรรมดา, ประเด็นการเมืองที่ยั่วยุ, เนื้อหาทางเพศ, หรือข้อมูลน้อยเกินกว่าจะเขียนให้มีสาระ
4. พาดหัวต้องชวนอ่านแต่ "ตรงกับเนื้อหา" ห้ามหลอกคลิก ห้ามใช้คำว่า "ช็อก" หากเนื้อหาไม่ได้น่าตกใจ
5. เพิ่มคุณค่าให้ผู้อ่าน: ที่มาของประเด็น บริบท และเหตุผลที่คนพูดถึง
6. ห้ามคัดลอกประโยคจากแหล่งข่าวยาวเกิน 10 คำ ให้เรียบเรียงใหม่ทั้งหมด
7. ไม่ต้องใส่ลิงก์หรือชื่อเว็บไซต์ของเราในเนื้อหา

สไตล์ให้อ่านแล้วไม่เหมือน AI (สำคัญมาก):
8. อ้างแหล่งข่าวด้วยชื่อจริง เช่น "ไทยรัฐรายงานว่า" "เจ้าตัวโพสต์ผ่านอินสตาแกรมว่า" "ในรายการตีท้ายครัว เธอเล่าว่า" — ใช้คำว่า "ตามรายงาน" ได้ไม่เกิน 1 ครั้งต่อบทความ
9. ห้ามปิดท้ายบทความหรือหัวข้อด้วยข้อคิด คำอวยพร หรือประโยคสวยหรู เช่น "นับเป็นอีกหนึ่ง..." "สร้างพลังบวก" "ต้องติดตามกันต่อไป" "เป็นกำลังใจให้" "บทเรียนราคาแพง" — ให้จบด้วยข้อเท็จจริงล่าสุด หรือสิ่งที่จะเกิดขึ้นตามกำหนดการจริงในแหล่งข่าว
10. จังหวะต้องไม่สม่ำเสมอแบบเครื่อง: บางย่อหน้าเป็นประโยคเดียวสั้น ๆ เพื่อเน้น บางย่อหน้ายาว 4-5 ประโยค ห้ามทุกหัวข้อมีจำนวนย่อหน้าเท่ากัน
11. คำโปรยและข้อสรุปห้ามขึ้นต้นด้วย "เกาะติด" "สรุป" "เปิดเรื่อง" "แสดงความยินดี" "ถอดบทเรียน"
12. หลีกเลี่ยงวลีซ้ำซากของ AI: "สร้างความฮือฮา" "ยิ้มแก้มปริ" "อย่างเนืองแน่น" "ไม่ว่าจะเป็น" "อีกทั้งยัง" "ถือเป็น" ใช้ได้เท่าที่จำเป็นจริง ๆ
13. หัวข้อย่อยต้องเฉพาะเจาะจงกับเรื่องนี้ ห้ามใช้หัวข้อกลาง ๆ เช่น "เกิดอะไรขึ้น" "ปฏิกิริยาชาวเน็ต" "สิ่งที่ต้องติดตาม"`;

// 글 형식 다양화: 모든 글이 같은 틀(요약3→섹션4→FAQ2)이면 여러 편을 읽을 때 기계 티가 남
export const FORMATS = {
  standard: { weight: 5, minSections: 3, minWords: 300, prompt: 'ข่าวปกติ: 3-4 หัวข้อย่อย ความยาวรวม 400-600 คำ FAQ 1-3 ข้อ' },
  brief: { weight: 2, minSections: 2, minWords: 200, prompt: 'ข่าวสั้นทันกระแส: 2-3 หัวข้อย่อย ความยาวรวม 250-380 คำ ไม่ต้องมีไทม์ไลน์ FAQ 0-1 ข้อ สรุป 2 ข้อ' },
  explainer: { weight: 2, minSections: 3, minWords: 380, prompt: 'เจาะลึกที่มาที่ไป: 4-5 หัวข้อย่อย ความยาวรวม 500-700 คำ เน้นลำดับเหตุการณ์และบริบทเบื้องหลัง FAQ 2-4 ข้อ' },
  qa: { weight: 1, minSections: 2, minWords: 250, prompt: 'ถาม-ตอบ: 2-3 หัวข้อย่อยสั้น ๆ แล้วตอบคำถามที่คนค้นหาเป็น FAQ 3-4 ข้อ (ตอบจากแหล่งข่าวเท่านั้น) ความยาวรวม 300-450 คำ' },
};
export function pickFormat(c) {
  // 검색량 큰 주제는 깊이 있는 형식 위주
  const pool = (c.traffic || 0) >= 20000 ? ['explainer', 'standard', 'standard'] : Object.entries(FORMATS).flatMap(([k, f]) => Array(f.weight).fill(k));
  return pool[Math.floor(Math.random() * pool.length)];
}

// 오류 분류
//  - FatalError: API 키/권한 문제 → 즉시 중단, 워크플로 실패 처리(알림 메일)
//  - QuotaExhausted: 사용 가능한 모든 모델의 무료 한도 소진 → 정상 종료, 다음 실행에서 재시도
// K-연예 글 추가 지침 (한국 원문 출처일 때 특히 중요)
const KOREA_RULES = `ข่าวนี้เป็นข่าววงการบันเทิงเกาหลี (หมวด K-บันเทิง) ผู้อ่านคือแฟนชาวไทย:
- แหล่งข่าวอาจเป็นภาษาเกาหลี: อ่านและเรียบเรียงเป็นภาษาไทย ห้ามแปลตรงทีละประโยค
- ชื่อศิลปิน/วง/ซีรีส์: ใช้ชื่อที่แฟนไทยใช้จริง ถ้าไม่แน่ใจให้ใช้ชื่อภาษาอังกฤษอย่างเป็นทางการ (เช่น BLACKPINK, Jennie, Queen of Tears) ห้ามถอดเสียงภาษาเกาหลีเป็นอักษรไทยเองแบบเดา
- อ้างสื่อเกาหลีด้วยชื่อ เช่น "สื่อเกาหลี Dispatch รายงานว่า" "ต้นสังกัด YG Entertainment ออกแถลงการณ์ว่า"
- อธิบายบริบทที่คนไทยอาจไม่รู้สั้น ๆ (รายการนี้คืออะไร สื่อนี้คือใคร ทำไมเรื่องนี้ใหญ่ในเกาหลี)
- ถ้าแหล่งข่าวระบุความเกี่ยวข้องกับไทย (สมาชิกชาวไทย คอนเสิร์ต/แฟนมีตในไทย ผลงานที่ฉายในไทย) ให้เน้นมุมนั้นเป็นหลัก แต่ห้ามแต่งความเกี่ยวข้องกับไทยขึ้นเอง
- ตั้ง publishable=false ถ้าเป็นเรื่องที่รู้จักเฉพาะในเกาหลีและแฟนไทยแทบไม่สนใจ (เช่น นักร้องทรอตท้องถิ่น การเมือง เรตติ้งรายการในประเทศของคนที่ไม่มีชื่อเสียงในไทย)
- category: ถ้าเป็นวงการบันเทิงเกาหลี (K-pop ไอดอลเกาหลี ซีรีส์/หนังเกาหลี นักแสดงเกาหลี) ต้องเป็น "K-บันเทิง" ถ้าไม่ใช่ (เช่น ศิลปินไทย/ญี่ปุ่น หนังฮอลลีวูด) ให้เลือกหมวดอื่นตามปกติ`;

export class FatalError extends Error {}
export class QuotaExhausted extends Error {}
const AUTH = /API key not valid|API_KEY_INVALID|permission denied|unauthorized|forbidden|PERMISSION_DENIED/i;
const QUOTA = /quota|RESOURCE_EXHAUSTED|\b429\b|rate.?limit|exceeded your current/i;
const GONE = /no longer available|is not found|not supported for generateContent|model.*not found/i;
const TRANSIENT = /high demand|overloaded|UNAVAILABLE|\b50[0234]\b|internal error|deadline|timed? ?out|ECONNRESET|ETIMEDOUT|fetch failed|socket hang up/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 사용 가능한 모델을 API 로 직접 조회 (모델명 단종/변경에 자동 대응)
let chain = null, pinned = [];
const exhausted = new Set(); // 이번 실행에서 한도 소진/단종 확인된 모델
const isLite = (n) => /lite/.test(n);

// 한도 소진된 모델은 쿨다운 동안 건너뜀 (.cache 는 Actions 캐시로 실행 간 유지)
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
  pinned = (process.env.GEMINI_MODEL || '').split(',').map((s) => s.trim()).filter(Boolean);
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
      found = [...ids.filter(isLite).sort(byNew), ...ids.filter((n) => !isLite(n)).sort(byNew)];
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

// 좋은 모델(GEMINI_MODEL 로 지정, 하루 한도 작음)은 검색량 큰 주제(premium)에만 우선 사용.
// 나머지 주제는 한도 넉넉한 lite 먼저 → 좋은 모델이 테스트·거부 글에 소진되지 않게
function modelOrder(premium) {
  const avail = chain.filter((n) => !exhausted.has(n));
  if (premium) return avail;
  return [...avail.filter((n) => isLite(n) && !pinned.includes(n)), ...avail.filter((n) => !isLite(n) && !pinned.includes(n)), ...avail.filter((n) => pinned.includes(n))];
}

/**
 * opts.premium: 검색량 큰 주제 → 좋은 모델 우선
 * 반환: { article, format, model }
 */
export async function writeArticle(c, facts, model, recentTitles = [], searchTerms = [], opts = {}) {
  if (!model && !chain) await resolveModels();
  const format = opts.format || pickFormat(c);
  // 의미 기반 중복 방지: 최근 발행 제목을 보여주고 같은 사건이면 스스로 거부하게 함
  const recentBlock = recentTitles.length
    ? 'บทความล่าสุดของเรา (ห้ามเขียนซ้ำเหตุการณ์เดียวกัน แม้จะใช้คีย์เวิร์ดหรือภาษาต่างกัน เช่น ชื่อทีมภาษาอังกฤษกับภาษาไทย):\n' +
      recentTitles.map((t) => `- ${t}`).join('\n') + '\n\n'
    : '';
  // 롱테일: 실제 검색어를 소제목/FAQ 방향으로만 제시. 출처에 없는 개인정보(나이·키·연애)는 절대 추측하지 않게 명시
  const searchBlock = searchTerms.length
    ? 'คำค้นยอดนิยมที่คนไทยพิมพ์ใน Google เกี่ยวกับเรื่องนี้ (ใช้เป็นแนวทางตั้งหัวข้อย่อยและ FAQ อย่างเป็นธรรมชาติ เฉพาะข้อที่แหล่งข่าวมีคำตอบ ห้ามเดาข้อมูลส่วนตัว เช่น อายุ ส่วนสูง แฟน ถ้าแหล่งข่าวไม่ได้ระบุ):\n' +
      searchTerms.map((t) => `- ${t}`).join('\n') + '\n\n'
    : '';
  const prompt = `${c.kr ? KOREA_RULES + '\n\n' : ''}${c.lang === 'ko' ? 'หัวข่าวจากสื่อเกาหลี' : 'คีย์เวิร์ดที่กำลังเป็นกระแสในไทย'}: "${c.keyword}"${c.traffic ? ` (ค้นหามากกว่า ${c.traffic.toLocaleString()} ครั้ง)` : ''}
วันที่ปัจจุบัน: ${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long' })}
รูปแบบบทความ: ${FORMATS[format].prompt}

ข้อมูลจากแหล่งข่าว:
${facts}

${searchBlock}${recentBlock}เขียนบทความตามกฎทั้งหมด (ถ้าซ้ำกับบทความข้างต้น → duplicateOf ใส่หัวข้อนั้น และ publishable=false)`;

  const order = model ? ['mock'] : modelOrder(!!opts.premium);
  if (!order.length) throw new QuotaExhausted('모든 모델의 무료 한도가 소진됨');
  let lastErr;
  for (const name of order) {
    let overload = 0;
    while (true) {
      try {
        const { output } = await generateText({ model: model ?? google(name), system: SYSTEM, prompt, output: Output.object({ schema: Article }), temperature: 0.75, maxRetries: 0 });
        return { article: output, format, model: model ? 'mock' : name };
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
          // 일일 한도 소진/단종 → 다음 모델 (이번 실행 동안 제외 + 쿨다운 기록)
          console.warn(`  model ${name} 사용 불가 (${QUOTA.test(msg) ? '한도 소진' : '단종'}) → 다음 모델`);
          exhausted.add(name);
          markCooldown(name, QUOTA.test(msg) ? msg : 'retry in 24h');
          break;
        }
        // 재시도는 일시적 오류(과부하·5xx·네트워크)만. 안전 차단·스키마 불일치 등은 다시 해도 같은 결과
        if (!TRANSIENT.test(msg) || ++overload > 2) throw lastErr;
        const wait = 8000 * overload;
        console.warn(`  retry ${overload} in ${wait / 1000}s: ${msg.slice(0, 120)}`);
        await sleep(wait);
      }
    }
  }
  throw new QuotaExhausted('모든 모델의 무료 한도가 소진됨');
}

const len = (s) => [...(s || '')].length;
const seg = new Intl.Segmenter('th', { granularity: 'word' });
const words = (s) => [...seg.segment(s)].filter((x) => x.isWordLike).length;

// 품질 게이트: 통과 못 하면 발행 안 함 (얇은 글은 사이트 전체 평가를 깎음). 기준은 글 형식별로 다름
export function qualityCheck(a, format = 'standard') {
  const f = FORMATS[format] || FORMATS.standard;
  const problems = [];
  if (a.duplicateOf?.trim()) problems.push(`duplicate of: ${a.duplicateOf.slice(0, 60)}`);
  else if (!a.publishable) problems.push(`not publishable: ${a.rejectReason}`);
  if (len(a.title) < 20 || len(a.title) > 130) problems.push(`title length ${len(a.title)}`);
  if (a.summary.length < 2) problems.push('summary < 2');
  if (a.sections.length < f.minSections) problems.push(`sections < ${f.minSections}`);
  // 문답형은 FAQ 답변도 본문 분량으로 인정
  const total = words([...a.summary, ...a.sections.flatMap((s) => [s.heading, ...s.paragraphs]), ...(format === 'qa' ? a.faq.flatMap((q) => [q.q, q.a]) : [])].join(' '));
  if (total < f.minWords) problems.push(`too short: ${total} words (${format})`);
  if (a.tags.length < 3) problems.push('tags < 3');
  return { ok: problems.length === 0, problems, words: total };
}

// ── AI 티 자동 교정 (결정적 규칙만: 의미를 바꾸지 않는 범위) ──
// 1) 같은 태국 자음 4번 이상 연속 = 오타 → 3개로 ("แนนนนี่" → "แนนนี่").
//    3번 연속은 정상 표기가 있음 (예: แนนนี่ = Nanny) → 건드리지 않음
const fixTypos = (s) => String(s).replace(/([ก-ฮ])\1{3,}/g, '$1$1$1');
// 2) 마지막 문단의 교훈형/덕담형 마무리 (AI 의 가장 전형적인 패턴) → 문단이 2개 이상이면 제거
const CLICHE_CLOSER = /นับเป็นอีกหนึ่ง|พลังบวก|เป็นกำลังใจ|ต้องติดตามกันต่อไป|ติดตามกันต่อไป|บทเรียนราคาแพง|ส่งกำลังใจ|ความสุขให้กับ|สร้างรอยยิ้มให้|อวยพรให้|ร่วมยินดี/;
export function polish(a) {
  const fix = (x) => (typeof x === 'string' ? fixTypos(x) : x);
  const out = {
    ...a,
    title: fix(a.title), excerpt: fix(a.excerpt), thumbText: fix(a.thumbText),
    summary: a.summary.map(fix),
    sections: a.sections.map((s) => ({ heading: fix(s.heading), paragraphs: s.paragraphs.map(fix) })),
    faq: a.faq.map((q) => ({ q: fix(q.q), a: fix(q.a) })),
    timeline: a.timeline.map((t) => ({ when: fix(t.when), what: fix(t.what) })),
  };
  const last = out.sections.at(-1);
  let removed = 0;
  while (last && last.paragraphs.length > 1 && CLICHE_CLOSER.test(last.paragraphs.at(-1))) { last.paragraphs.pop(); removed++; }
  return { article: out, removedClosers: removed };
}

export function normalize(a) {
  return {
    ...a,
    summary: a.summary.slice(0, 4),
    sections: a.sections.slice(0, 6).map((s) => ({ heading: s.heading.trim(), paragraphs: s.paragraphs.map((p) => p.trim()).filter(Boolean) })),
    tags: [...new Set(a.tags.map((t) => t.replace(/^#/, '').trim()).filter(Boolean))].slice(0, 6),
    faq: a.faq.slice(0, 4),
    entities: (a.entities || []).filter((e) => e.name?.trim()).slice(0, 4),
    timeline: a.timeline.slice(0, 8),
  };
}
