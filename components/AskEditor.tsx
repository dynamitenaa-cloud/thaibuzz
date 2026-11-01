'use client';
import { useState } from 'react';

// "ถามบรรณาธิการชาวเกาหลี": 질문 → /api/ask → 편집자 텔레그램 → 답장하면 /ask/ 에 게시
export function AskEditor({ slug, compact }: { slug?: string; compact?: boolean }) {
  const [text, setText] = useState('');
  const [hp, setHp] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'err'>('idle');
  const [msg, setMsg] = useState('');
  const len = [...text.trim()].length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (len < 10 || state === 'sending') return;
    setState('sending');
    try {
      const r = await fetch('/api/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, slug, website: hp }) });
      if (r.ok) { setState('ok'); setText(''); return; }
      const j = await r.json().catch(() => ({}));
      setMsg(j.error === 'rate' ? 'ส่งบ่อยเกินไป ลองใหม่ภายหลังนะครับ' : j.error === 'links' ? 'ไม่รองรับลิงก์ในคำถามครับ' : j.error === 'length' ? 'พิมพ์ 10–400 ตัวอักษรนะครับ' : 'ส่งไม่สำเร็จ ลองใหม่อีกครั้งครับ');
    } catch { setMsg('ส่งไม่สำเร็จ ลองใหม่อีกครั้งครับ'); }
    setState('err');
  };

  if (state === 'ok') return <div className={`ask${compact ? ' compact' : ''}`}><p className="ask-ok">✅ ส่งคำถามให้บรรณาธิการแล้วครับ — ถ้าได้รับเลือก คำตอบจะขึ้นที่ <a href="/ask/">หน้าถามบรรณาธิการ</a></p></div>;
  return (
    <form className={`ask${compact ? ' compact' : ''}`} onSubmit={submit}>
      <label htmlFor={`ask-${slug || 'page'}`}><b>🇰🇷 อยากถามอะไรเกี่ยวกับเกาหลี?</b><small>ถามชินได้เลย — เรื่องวัฒนธรรม ดารา ซีรีส์ ภาษา หรือชีวิตในเกาหลี</small></label>
      <textarea id={`ask-${slug || 'page'}`} value={text} onChange={(e) => setText(e.target.value)} maxLength={400} rows={3} placeholder="พิมพ์คำถามของคุณที่นี่…" />
      <input type="text" name="website" value={hp} onChange={(e) => setHp(e.target.value)} tabIndex={-1} autoComplete="off" aria-hidden className="hp" />
      <div className="ask-row">
        <small>{len}/400</small>
        <button type="submit" disabled={len < 10 || state === 'sending'}>{state === 'sending' ? 'กำลังส่ง…' : 'ส่งคำถาม'}</button>
      </div>
      {state === 'err' && <p className="ask-err" role="alert">{msg}</p>}
    </form>
  );
}
