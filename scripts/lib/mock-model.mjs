// `node scripts/run-pipeline.mjs --mock` : API 키 없이 파이프라인 전체(소스→게이트→썸네일→저장)를 시험
import { MockLanguageModelV4 } from 'ai/test';

const P = 'ข้อความทดสอบระบบอัตโนมัติ ใช้ตรวจว่าขั้นตอนการสร้างบทความ การตรวจคุณภาพ และการบันทึกไฟล์ทำงานครบถ้วน ไม่ใช่เนื้อหาข่าวจริงและจะถูกลบหลังการทดสอบ ระบบจะสร้างหัวข้อย่อยหลายส่วนเพื่อให้ความยาวผ่านเกณฑ์ขั้นต่ำของบทความ';

export default new MockLanguageModelV4({
  doGenerate: async (opts) => {
    const text = JSON.stringify(opts.prompt);
    const kw = text.match(/คีย์เวิร์ดที่กำลังเป็นกระแสในไทย: \\"(.+?)\\"/)?.[1] ?? 'ทดสอบ';
    const article = {
      publishable: true,
      duplicateOf: '',
      rejectReason: '',
      title: `[ทดสอบระบบ] ${kw} สรุปประเด็นที่คนพูดถึง`,
      excerpt: `บทความทดสอบสำหรับคีย์เวิร์ด ${kw} เพื่อตรวจสอบการทำงานของระบบอัตโนมัติตั้งแต่ต้นจนจบ`,
      thumbText: kw.slice(0, 30),
      summary: ['ประเด็นทดสอบที่หนึ่ง', 'ประเด็นทดสอบที่สอง', 'ประเด็นทดสอบที่สาม'],
      sections: [1, 2, 3, 4].map((i) => ({ heading: `หัวข้อทดสอบ ${i}`, paragraphs: [P, P, P] })),
      timeline: [],
      faq: [{ q: 'นี่คือข่าวจริงไหม?', a: 'ไม่ใช่ เป็นข้อมูลทดสอบ' }],
      tags: [kw, 'ทดสอบ', 'ระบบอัตโนมัติ'],
      entities: [{ name: kw.slice(0, 20), type: 'other' }],
      category: 'ข่าวทั่วไป',
      imageAlt: kw,
      koreaAngle: '',
      socialHook: 'งานนี้แฟน ๆ กรี๊ดสนั่น',
      socialQuestion: 'คิดว่ายังไงกันบ้าง?',
    };
    return {
      content: [{ type: 'text', text: JSON.stringify(article) }],
      finishReason: { unified: 'stop', raw: undefined },
      usage: { inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined }, outputTokens: { total: 1, text: 1, reasoning: undefined } },
      warnings: [],
    };
  },
});

// roundup.mjs --mock 용: 아침 정리 스키마에 맞는 응답
export const roundupMock = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [{ type: 'text', text: JSON.stringify({
      title: 'สรุปข่าวเช้า (ทดสอบ): ลิซ่าปล่อย EP ใหม่, แมนยูยังไม่ฟื้น, ราคาทองร่วง',
      excerpt: 'ตื่นมาเช้านี้มีเรื่องต้องรู้หลายอย่าง ตั้งแต่วงการ K-pop ไปจนถึงราคาทองที่ขยับแรง อ่านสั้น ๆ ก่อนออกจากบ้าน',
      intro: 'อรุณสวัสดิ์ครับ เช้านี้ขอเริ่มที่ข่าวบันเทิงก่อนเลย แล้วค่อยไปดูเรื่องเงิน ๆ ทอง ๆ ที่หลายคนจับตา มี 5 เรื่องที่ควรรู้ก่อนเริ่มวัน',
      headlines: ['ข้อ 1 ทดสอบ', 'ข้อ 2 ทดสอบ', 'ข้อ 3 ทดสอบ', 'ข้อ 4 ทดสอบ', 'ข้อ 5 ทดสอบ'],
      thumbText: 'สรุปข่าวเช้า (ทดสอบ)',
      socialHook: 'ตื่นมาเจอข่าวนี้ก่อนเลย',
      socialQuestion: 'เช้านี้เรื่องไหนที่คุณสนใจที่สุด?',
    }) }],
    finishReason: { unified: 'stop', raw: undefined },
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    warnings: [],
  }),
});

// hub-intros.mjs --mock 용
export const hubMock = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [{ type: 'text', text: JSON.stringify({
      seoTitle: 'หัวข้อทดสอบ ข่าวล่าสุด ทุก EP ย้อนหลัง',
      intro: ['ย่อหน้าทดสอบที่หนึ่ง อธิบายว่าหัวข้อนี้คืออะไรตามบทความ', 'ย่อหน้าทดสอบที่สอง สรุปความเคลื่อนไหวล่าสุด'],
      facts: ['ข้อเท็จจริงทดสอบ 1', 'ข้อเท็จจริงทดสอบ 2', 'ข้อเท็จจริงทดสอบ 3'],
    }) }],
    finishReason: { unified: 'stop', raw: undefined },
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    warnings: [],
  }),
});
