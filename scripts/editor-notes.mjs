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
// 한 모델이 단종/한도 소진이어도 번역이 죽지 않게 순서대로 시도
const MODELS = [...new Set([process.env.NOTES_MODEL, 'gemini-2.5-flash-lite', 'gemini-3.8-flash-lite', ...(process.env.GEMINI_MODEL || '').split(','), 'gemini-3.8-flash'].map((s) => (s || '').trim()).filter(Boolean))];
async function toThai(text) {
  if (isThai(text)) return text.trim();
  let lastErr;
  for (const name of MODELS) {
    try {
      const { text: out } = await generateText({
        model: google(name),
        prompt: `แปลข้อความต่อไปนี้เป็นภาษาไทยที่เป็นธรรมชาติ สำหรับ "มุมมองจากบรรณาธิการชาวเกาหลี" ในเว็บข่าว (คงน้ำเสียงบุคคลที่หนึ่งของผู้เขียน) แปลเฉพาะความหมายเดิม ห้ามเพิ่มข้อมูลใหม่ ตอบเฉพาะคำแปล:\n\n${text}`,
        maxRetries: 1,
      });
      if (out?.trim()) return out.trim();
    } catch (e) { lastErr = e; console.warn(`notes: ${name} 실패 → 다음 모델:`, String(e.message).slice(0, 120)); }
  }
  throw lastErr || new Error('no model');
}

let changed = 0, last = offset;
for (const u of upd.result || []) {
  last = Math.max(last, u.update_id + 1);
  const m = u.message;
  if (!m || String(m.chat?.id) !== CHAT || !m.text) continue;
  // 독자 질문(/api/ask 가 보낸 "[Q-xxxxxxxx]" 메시지)에 대한 답장 → content/qa/<id>.json (사이트 /ask/ 에 게시)
  const qm = (m.reply_to_message?.text || '').match(/\[Q-([0-9a-f]{8})\]/);
  if (qm) {
    const id = qm[1];
    const file = path.join('content', 'qa', `${id}.json`);
    const say = (text) => api('sendMessage', { chat_id: CHAT, reply_to_message_id: m.message_id, text });
    if (/^(삭제|ลบ|delete)$/i.test(m.text.trim())) {
      if (fs.existsSync(file)) { fs.rmSync(file); changed++; await say('🗑 Q&A 삭제 — 다음 배포에 반영'); }
      continue;
    }
    if ([...m.text.trim()].length < 25) { await say('⚠️ 답변이 너무 짧아요 (25자 이상). 한국어로 써도 태국어로 번역됩니다.'); continue; }
    const q = (m.reply_to_message.text.split('\n\n')[1] || '').trim();
    if (!q) continue;
    try {
      const a = (await toThai(m.text)).slice(0, 900);
      const slug = m.reply_to_message.text.match(/\/post\/([0-9]{8}-[0-9a-f]{8})\//)?.[1];
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify({ id, q, a, at: new Date().toISOString(), ...(slug ? { slug } : {}) }, null, 2));
      changed++;
      console.log(`notes: Q&A ${id} 게시`);
      await say(`✅ /ask/ 에 게시됩니다 (다음 배포)

Q. ${q}
A. ${a}

지우려면 "삭제"라고 답장`);
    } catch (e) { console.warn('notes: Q&A 번역 실패', e.message); await say('⚠️ 번역 실패 — 잠시 후 다시 답장해 주세요'); }
    continue;
  }
  // 답장 대상 메시지(영상 캡션)에 들어 있는 글 ID
  const slug = (m.reply_to_message?.caption || m.reply_to_message?.text || '').match(/🆔\s*([0-9]{8}-[0-9a-f]{8})/)?.[1];
  if (!slug) continue;
  const file = path.join('content', 'posts', `${slug}.json`);
  if (!fs.existsSync(file)) { await api('sendMessage', { chat_id: CHAT, reply_to_message_id: m.message_id, text: `⚠️ 글을 찾을 수 없음 (${slug}) — 보관 처리된 글일 수 있습니다` }); continue; }
  const post = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (/^(삭제|ลบ|delete)$/i.test(m.text.trim())) {
    delete post.editorNote; delete post.editorNoteAt;
    await api('sendMessage', { chat_id: CHAT, reply_to_message_id: m.message_id, text: '🗑 편집자 노트 삭제 — 다음 배포에 반영' });
  } else if ([...m.text.trim()].length < 25) {
    // 짧은 답장(잡담·테스트·질문 한마디)은 사이트에 "편집자 시선"으로 붙이지 않음
    await api('sendMessage', { chat_id: CHAT, reply_to_message_id: m.message_id, text: '⚠️ 너무 짧아서 반영 안 함 (25자 이상)\n\n편집자 노트는 사이트에 "한국인 편집자의 시선"으로 공개됩니다. 한국 사람만 아는 한두 문장으로 써 주세요.\n예: "이 배우는 한국에선 드라마보다 광고로 더 유명해요. 이번 작품이 첫 주연이라 한국 반응도 뜨거워요."\n\n지우려면 "삭제"라고 답장' });
    continue;
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
