// 편집자 노트: 텔레그램으로 받은 영상 메시지에 "답장"으로 한 줄 코멘트를 보내면
// 해당 글에 "หมายเหตุจากบรรณาธิการ"(편집자 노트)로 붙인다 → 사람 손길(E-E-A-T) + AI 티 완화
//  - 한국어 등으로 써도 됨: 태국어가 아니면 Gemini(lite)로 자연스러운 태국어로 옮김 (원문 의미만, 내용 추가 금지)
//  - "삭제" / "ลบ" 라고 답장하면 노트 제거
//  - 처리 위치는 .cache/tg-offset.json (텔레그램 getUpdates offset) 로 기억
import fs from 'node:fs';
import path from 'node:path';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT = String(process.env.TELEGRAM_CHAT_ID || '');
if (!TOKEN || !CHAT) { console.log('notes: 텔레그램 설정 없음 → 건너뜀'); process.exit(0); }

const OFFSET_FILE = '.cache/tg-offset.json';
const api = (m, params) => fetch(`https://api.telegram.org/bot${TOKEN}/${m}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(params) }).then((r) => r.json());

let offset = 0;
try { offset = JSON.parse(fs.readFileSync(OFFSET_FILE, 'utf8')).offset || 0; } catch {}
const upd = await api('getUpdates', { offset, timeout: 0, allowed_updates: ['message'] });
if (!upd.ok) { console.warn('notes: getUpdates 실패', JSON.stringify(upd).slice(0, 200)); process.exit(0); }

const isThai = (s) => ((s.match(/[฀-๿]/g) || []).length / Math.max(1, s.replace(/\s/g, '').length)) > 0.5;
async function toThai(text) {
  if (isThai(text)) return text.trim();
  const { text: out } = await generateText({
    model: google(process.env.NOTES_MODEL || 'gemini-2.5-flash-lite'),
    prompt: `แปลข้อความต่อไปนี้เป็นภาษาไทยที่เป็นธรรมชาติ สำหรับ "มุมมองจากบรรณาธิการชาวเกาหลี" ในเว็บข่าว (คงน้ำเสียงบุคคลที่หนึ่งของผู้เขียน) แปลเฉพาะความหมายเดิม ห้ามเพิ่มข้อมูลใหม่ ตอบเฉพาะคำแปล:\n\n${text}`,
    maxRetries: 1,
  });
  return out.trim();
}

let changed = 0, last = offset;
for (const u of upd.result || []) {
  last = Math.max(last, u.update_id + 1);
  const m = u.message;
  if (!m || String(m.chat?.id) !== CHAT || !m.text) continue;
  // 답장 대상 메시지(영상 캡션)에 들어 있는 글 ID
  const slug = (m.reply_to_message?.caption || m.reply_to_message?.text || '').match(/🆔\s*([0-9]{8}-[0-9a-f]{8})/)?.[1];
  if (!slug) continue;
  const file = path.join('content', 'posts', `${slug}.json`);
  if (!fs.existsSync(file)) { await api('sendMessage', { chat_id: CHAT, reply_to_message_id: m.message_id, text: `⚠️ 글을 찾을 수 없음 (${slug}) — 보관 처리된 글일 수 있습니다` }); continue; }
  const post = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (/^(삭제|ลบ|delete)$/i.test(m.text.trim())) {
    delete post.editorNote; delete post.editorNoteAt;
    await api('sendMessage', { chat_id: CHAT, reply_to_message_id: m.message_id, text: '🗑 편집자 노트 삭제 — 다음 배포에 반영' });
  } else {
    try {
      post.editorNote = (await toThai(m.text)).slice(0, 400);
      post.editorNoteAt = new Date().toISOString();
      await api('sendMessage', { chat_id: CHAT, reply_to_message_id: m.message_id, text: `✅ 편집자 노트 반영 (곧 사이트에 표시)\n\n${post.editorNote}` });
    } catch (e) {
      console.warn('notes: 번역 실패', e.message);
      await api('sendMessage', { chat_id: CHAT, reply_to_message_id: m.message_id, text: '⚠️ 번역 실패 — 태국어로 보내 주시거나 잠시 후 다시 답장해 주세요' });
      continue;
    }
  }
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(post, null, 2)); fs.renameSync(tmp, file);
  changed++;
  console.log(`notes: ${slug} 업데이트`);
}
fs.mkdirSync('.cache', { recursive: true });
fs.writeFileSync(OFFSET_FILE, JSON.stringify({ offset: last }));
console.log(`notes: ${changed}건 반영`);
if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\n`);
