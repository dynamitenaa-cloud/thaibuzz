// `node scripts/run-pipeline.mjs --mock` : API 키 없이 파이프라인 전체(소스→게이트→썸네일→저장)를 시험
import { MockLanguageModelV4 } from 'ai/test';

const P = 'ข้อความทดสอบระบบอัตโนมัติ ใช้ตรวจว่าขั้นตอนการสร้างบทความ การตรวจคุณภาพ และการบันทึกไฟล์ทำงานครบถ้วน ไม่ใช่เนื้อหาข่าวจริงและจะถูกลบหลังการทดสอบ ระบบจะสร้างหัวข้อย่อยหลายส่วนเพื่อให้ความยาวผ่านเกณฑ์ขั้นต่ำของบทความ';

export default new MockLanguageModelV4({
  doGenerate: async (opts) => {
    const text = JSON.stringify(opts.prompt);
    const kw = text.match(/คีย์เวิร์ดที่กำลังเป็นกระแสในไทย: \\"(.+?)\\"/)?.[1] ?? 'ทดสอบ';
    const article = {
      publishable: true,
      rejectReason: '',
      title: `[ทดสอบระบบ] ${kw} สรุปประเด็นที่คนพูดถึง`,
      excerpt: `บทความทดสอบสำหรับคีย์เวิร์ด ${kw} เพื่อตรวจสอบการทำงานของระบบอัตโนมัติตั้งแต่ต้นจนจบ`,
      thumbText: kw.slice(0, 30),
      summary: ['ประเด็นทดสอบที่หนึ่ง', 'ประเด็นทดสอบที่สอง', 'ประเด็นทดสอบที่สาม'],
      sections: [1, 2, 3, 4].map((i) => ({ heading: `หัวข้อทดสอบ ${i}`, paragraphs: [P, P, P] })),
      timeline: [],
      faq: [{ q: 'นี่คือข่าวจริงไหม?', a: 'ไม่ใช่ เป็นข้อมูลทดสอบ' }],
      tags: [kw, 'ทดสอบ', 'ระบบอัตโนมัติ'],
      category: 'ข่าวทั่วไป',
      imageAlt: kw,
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(article) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
      warnings: [],
    };
  },
});
