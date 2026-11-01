// 페북 그룹 공유 키트: 하루 1번, 그날 공유할 만한 글 N개를 골라 "그룹용 태국어 캡션 3종"과 함께 텔레그램으로 보냄
//  - 자동 게시가 아님 (메타가 그룹 게시 API 를 막았고, 같은 링크를 여러 그룹에 뿌리면 스팸 제한). 사람이 복사해서 올림
//  - 캡션 3종: A 질문형 / B 공감·한줄평형 / C 투표형 — 링크는 본문에 넣지 말고 "첫 댓글"에 (링크 글은 그룹에서 노출이 줄고 삭제되기 쉬움)
//  - 기록: .cache/group-kit.json (같은 글을 두 번 추천하지 않음)
// 필요: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GOOGLE_GENERATIVE_AI_API_KEY (LLM 실패 시 규칙 기반 캡션으로 대체)
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { generateJSON } from './lib/writer.mjs';
import { telegramReady, sendTelegramText } from './lib/delivery.mjs';
import { questionOf } from './lib/social.mjs';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thaibuzz.net').replace(/\/$/, '');
const N = Number(process.env.GROUP_KIT_POSTS || 2);
const WINDOW_H = Number(process.env.GROUP_KIT_WINDOW_H || 36);
const DRY = process.argv.includes('--dry');
const LEDGER = '.cache/group-kit.json';
const KR_CAT = 'K-บันเทิง';

if (!DRY && !telegramReady()) { console.log('group-kit: 텔레그램 설정 없음'); process.exit(0); }

const ledger = fs.existsSync(LEDGER) ? JSON.parse(fs.readFileSync(LEDGER, 'utf8')) : {};
const now = Date.now();
const hasNote = (p) => [...(p.editorNote || '').trim()].length >= 60;
const posts = fs.readdirSync('content/posts').filter((f) => f.endsWith('.json') && !f.startsWith('demo-'))
  .map((f) => JSON.parse(fs.readFileSync(path.join('content/posts', f), 'utf8')))
  .filter((p) => p.format !== 'roundup' && now - Date.parse(p.createdAt) < WINDOW_H * 36e5 && !ledger[p.slug]);

// 정치·사건성 주제는 그룹 공유에서 제외 (커뮤니티 분쟁·삭제 위험)
const RISKY = /การเมือง|เลือกตั้ง|รัฐบาล|พรรค|ศาล|คดี|ฆาตกรรม|ข่มขืน|อุบัติเหตุ|เสียชีวิต|พนัน|หวย|ลอตเตอรี่/;
const score = (p) => (p.origin === 'kr' ? 3 : 0) + (hasNote(p) ? 2 : 0) + (p.poll ? 0.7 : 0) + Math.log10((p.traffic || 100) + 10);
const ranked = posts.filter((p) => !RISKY.test([p.title, ...(p.tags || [])].join(' '))).sort((a, b) => score(b) - score(a));
// 같은 카테고리만 몰리지 않게 (가능하면 서로 다른 카테고리)
const picks = [];
for (const p of ranked) if (picks.length < N && !picks.some((x) => x.category === p.category)) picks.push(p);
for (const p of ranked) if (picks.length < N && !picks.includes(p)) picks.push(p);
if (!picks.length) { console.log('group-kit: 추천할 글 없음'); process.exit(0); }

const Schema = z.object({
  a: z.string().describe('แบบ A (คำถาม): 2-3 บรรทัด เปิดด้วยคำถามที่คนอยากตอบในคอมเมนต์ ไม่มีลิงก์ ไม่มีแฮชแท็ก'),
  b: z.string().describe('แบบ B (ความเห็นสั้น ๆ): 2-3 บรรทัด เล่าประเด็นเหมือนเพื่อนเล่าให้เพื่อนฟังในกลุ่ม แล้วชวนแสดงความเห็น ไม่มีลิงก์ ไม่มีแฮชแท็ก'),
  c: z.string().describe('แบบ C (ให้เลือก): 2-4 บรรทัด ตั้งตัวเลือก 2 ข้อให้คอมเมนต์เลือก (เช่น "ทีม A หรือ ทีม B?") ไม่มีลิงก์ ไม่มีแฮชแท็ก'),
});
const system = `คุณเป็นสมาชิกกลุ่ม Facebook ภาษาไทยที่เล่าข่าวให้เพื่อนฟัง ไม่ใช่เพจข่าวที่โปรโมตตัวเอง เขียนภาษาพูดธรรมชาติ ห้ามมีลิงก์ ห้ามแฮชแท็ก ห้ามหลอกคลิก ห้ามมีอักษรเกาหลี ห้ามแต่งข้อเท็จจริงนอกเหนือจากข้อมูลที่ให้ ใช้อีโมจิได้ไม่เกิน 2 ตัวต่อแบบ`;

const ruleBased = (p) => {
  const q = questionOf(p).replace(/\s*👇$/, '');
  const opts = p.poll?.length >= 2 ? p.poll.slice(0, 3).join(' หรือ ') : 'เห็นด้วย หรือ ไม่เห็นด้วย';
  return { a: `${p.hook || p.title}\n${q} 👇`, b: `${p.title}\nใครตามเรื่องนี้อยู่บ้าง? เห็นยังไงกันบ้าง`, c: `${p.hook || p.title}\n${p.question || 'คิดว่ายังไง?'}\n${opts} — คอมเมนต์ได้เลย 👇` };
};

fs.mkdirSync('.cache', { recursive: true });
let sent = 0;
if (!DRY) await sendTelegramText(`📣 오늘의 페북 그룹 공유 키트 (${picks.length}개)\n\n✅ 규칙\n• 하루 그룹 3~5곳만, 같은 그룹엔 하루 1번\n• 캡션을 복사해 올리고 링크는 "첫 댓글"에 붙이기\n• 그룹마다 A/B/C 중 다른 캡션 쓰기 (같은 글 복붙 금지)\n• 올리기 전/후에 그 그룹 다른 글에 댓글 1~2개 달기 (차단 방지)\n• 그룹 규칙이 홍보 금지면 그 그룹은 건너뛰기`);
for (const [i, p] of picks.entries()) {
  let cap;
  try {
    const prompt = `ข่าว: ${p.title}\nสรุป: ${(p.summary || []).slice(0, 3).join(' / ')}\nหมวด: ${p.category}\nคำถามชวนคุย: ${p.question || '-'}\nตัวเลือกโหวต: ${(p.poll || []).join(' / ') || '-'}\n\nเขียนแคปชันสำหรับโพสต์ลงกลุ่ม 3 แบบ (A/B/C) ของข่าวนี้`;
    cap = await generateJSON(prompt, Schema, { system, temperature: 0.9 });
    if (/[가-힣]|https?:\/\//.test(JSON.stringify(cap))) throw new Error('한글/링크 섞임');
  } catch (e) { console.warn(`group-kit: LLM 실패(${String(e.message).slice(0, 80)}) → 규칙 기반 캡션`); cap = ruleBased(p); }
  const url = `${SITE}/post/${p.slug}/`;
  const tag = p.origin === 'kr' ? '🇰🇷 K-ent' : p.category;
  console.log(`group-kit: ${i + 1}/${picks.length} ${p.slug} [${tag}] ${p.title.slice(0, 50)}`);
  if (DRY) { console.log(JSON.stringify(cap, null, 1)); continue; }
  try {
    await sendTelegramText(`━━━ ${i + 1}/${picks.length} · ${tag} ━━━\n${p.title}`, [{ text: '🖼 이미지·글 열기', url }]);
    for (const [k, label] of [['a', 'A 질문형'], ['b', 'B 한줄평형'], ['c', 'C 투표형']]) {
      await sendTelegramText(`${cap[k].trim()}`);
      await sendTelegramText(`↑ ${label} (복사해서 그룹에 올리기)`);
    }
    await sendTelegramText(`🔗 첫 댓글에 붙일 링크:\n${url}${p.poll ? '\n🗳 글 안에서 투표도 할 수 있어요' : ''}`);
    ledger[p.slug] = now; sent++;
  } catch (e) { console.error(`group-kit: ${p.slug} 전송 실패 — ${e.message}`); }
}
for (const [k, t] of Object.entries(ledger)) if (now - t > 14 * 864e5) delete ledger[k];
fs.writeFileSync(LEDGER, JSON.stringify(ledger));
console.log(`group-kit: ${sent}개 전송`);
