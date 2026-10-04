// LLM 기사 작성 + 품질 게이트
import { generateText, Output } from 'ai';
import { google } from '@ai-sdk/google';
import { z } from 'zod';

export const CATEGORY_NAMES = ['บันเทิง', 'ซีรีส์/หนัง', 'โซเชียล/ไวรัล', 'ข่าวทั่วไป', 'กีฬา', 'ไลฟ์สไตล์'];
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

const Article = z.object({
  publishable: z.boolean().describe('true เฉพาะเมื่อข้อมูลเพียงพอ ถูกต้อง และปลอดภัยตามกฎ'),
  rejectReason: z.string().describe('เหตุผลหากไม่เผยแพร่ ถ้าเผยแพร่ให้เป็นสตริงว่าง'),
  title: z.string().describe('พาดหัวภาษาไทย 40-90 ตัวอักษร ดึงดูดแต่ตรงกับเนื้อหา'),
  excerpt: z.string().describe('คำโปรย/meta description 120-160 ตัวอักษร'),
  thumbText: z.string().describe('ข้อความบนภาพปก 12-36 ตัวอักษร กระชับ ชวนคลิก แต่ไม่บิดเบือน'),
  summary: z.array(z.string()).describe('สรุปประเด็นสำคัญ 3 ข้อ ข้อละ 1 ประโยค'),
  sections: z
    .array(z.object({ heading: z.string(), paragraphs: z.array(z.string()) }))
    .describe('3-5 หัวข้อย่อย แต่ละหัวข้อ 1-3 ย่อหน้า ย่อหน้าละ 2-4 ประโยค'),
  timeline: z.array(z.object({ when: z.string(), what: z.string() })).describe('ลำดับเหตุการณ์ (ถ้ามีวันที่/ลำดับชัดเจนในแหล่งข่าว) ไม่มีให้เป็นอาร์เรย์ว่าง'),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).describe('0-3 คำถามที่ผู้อ่านน่าจะสงสัย ตอบจากข้อเท็จจริงเท่านั้น'),
  tags: z.array(z.string()).describe('4-6 แท็ก: ชื่อบุคคล/ผลงาน/หัวข้อ ภาษาไทยหรือชื่อเฉพาะ'),
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
7. ไม่ต้องใส่ลิงก์หรือชื่อเว็บไซต์ของเราในเนื้อหา`;

// 재시도해도 소용없는 오류(모델 단종·키/권한 문제) → 즉시 전체 중단하고 워크플로를 실패 처리해 알림이 가게 함
export class FatalError extends Error {}
const FATAL = /no longer available|not found|is not supported|API key|permission|unauthorized|forbidden|invalid.*key|billing/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function writeArticle(c, facts, model = google(MODEL)) {
  const prompt = `คีย์เวิร์ดที่กำลังเป็นกระแสในไทย: "${c.keyword}"${c.traffic ? ` (ค้นหามากกว่า ${c.traffic.toLocaleString()} ครั้ง)` : ''}
วันที่ปัจจุบัน: ${new Date().toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'long' })}

ข้อมูลจากแหล่งข่าว:
${facts}

เขียนบทความตามกฎทั้งหมด`;
  let lastErr;
  for (let i = 0; i < 4; i++) {
    try {
      const { output } = await generateText({ model, system: SYSTEM, prompt, output: Output.object({ schema: Article }), temperature: 0.6 });
      return output;
    } catch (e) {
      lastErr = e;
      if (FATAL.test(String(e?.message))) throw new FatalError(String(e.message));
      const wait = /429|quota|rate/i.test(String(e?.message)) ? 30000 * (i + 1) : 4000 * (i + 1);
      console.warn(`  retry ${i + 1} in ${wait / 1000}s: ${String(e?.message).slice(0, 120)}`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

const len = (s) => [...(s || '')].length;
const seg = new Intl.Segmenter('th', { granularity: 'word' });
const words = (s) => [...seg.segment(s)].filter((x) => x.isWordLike).length;

// 품질 게이트: 통과 못 하면 발행 안 함 (얇은 글은 사이트 전체 평가를 깎음)
export function qualityCheck(a) {
  const problems = [];
  if (!a.publishable) problems.push(`not publishable: ${a.rejectReason}`);
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
    faq: a.faq.slice(0, 3),
    timeline: a.timeline.slice(0, 8),
  };
}
