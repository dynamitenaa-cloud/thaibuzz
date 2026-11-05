'use client';
import { useEffect, useMemo, useRef, useState } from 'react';

// BEST 11 만들기: 포메이션 선택 → 슬롯 눌러 선수 고르기(리그를 바꿔 섞어도 됨) → 공유용 이미지(canvas)로 저장/공유. 서버에 저장하는 건 없음 (내 브라우저에만 기억)
type Pos = 'GK' | 'DF' | 'MF' | 'FW';
type P = { id: string; n: string; p: Pos; no: string };
type Team = { id: string; name: string; players: P[] };
type Pick = { id: string; n: string; no: string; t: string; p: Pos };
export type LeagueOpt = { slug: string; name: string };

const FORMS: Record<string, [Pos, number][]> = {
  '4-3-3': [['FW', 3], ['MF', 3], ['DF', 4], ['GK', 1]],
  '4-4-2': [['FW', 2], ['MF', 4], ['DF', 4], ['GK', 1]],
  '4-2-3-1': [['FW', 1], ['MF', 3], ['MF', 2], ['DF', 4], ['GK', 1]],
  '3-5-2': [['FW', 2], ['MF', 5], ['DF', 3], ['GK', 1]],
  '3-4-3': [['FW', 3], ['MF', 4], ['DF', 3], ['GK', 1]],
};
const POS_TH: Record<Pos, string> = { GK: 'ผู้รักษาประตู', DF: 'กองหลัง', MF: 'กองกลาง', FW: 'กองหน้า' };
const KEY = 'tb-best11';
const slotsOf = (f: string) => FORMS[f].flatMap(([pos, n], r) => Array.from({ length: n }, (_, i) => ({ key: `${r}-${i}`, pos, row: r })));
const lastName = (n: string) => n.split(' ').slice(-1)[0];

export function Best11({ leagues }: { leagues: LeagueOpt[] }) {
  const [form, setForm] = useState('4-3-3');
  const [picks, setPicks] = useState<Record<string, Pick>>({});
  const [lg, setLg] = useState(leagues[0]?.slug ?? '');
  const [teams, setTeams] = useState<Record<string, Team[]>>({});
  const [open, setOpen] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [tf, setTf] = useState('');
  const [note, setNote] = useState('');
  const loaded = useRef(false);

  useEffect(() => { // 내 브라우저에 저장된 팀 복원
    try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s?.form && FORMS[s.form]) { setForm(s.form); setPicks(s.picks || {}); } } catch {}
    loaded.current = true;
  }, []);
  useEffect(() => { if (loaded.current) try { localStorage.setItem(KEY, JSON.stringify({ form, picks })); } catch {} }, [form, picks]);
  useEffect(() => {
    if (!lg || teams[lg]) return;
    fetch(`/football/rosters/${lg}.json`).then((r) => r.json()).then((j) => setTeams((t) => ({ ...t, [lg]: j.teams || [] }))).catch(() => setTeams((t) => ({ ...t, [lg]: [] })));
  }, [lg, teams]);

  const slots = useMemo(() => slotsOf(form), [form]);
  const rows = FORMS[form];
  const filled = slots.filter((s) => picks[s.key]).length;

  const changeForm = (f: string) => { // 같은 포지션 선수를 순서대로 새 포메이션 슬롯에 다시 배치
    const old = slotsOf(form);
    const byPos: Record<string, Pick[]> = {};
    for (const s of old) if (picks[s.key]) (byPos[s.pos] ||= []).push(picks[s.key]);
    const np: Record<string, Pick> = {};
    for (const s of slotsOf(f)) { const x = byPos[s.pos]?.shift(); if (x) np[s.key] = x; }
    setForm(f); setPicks(np);
  };

  const used = new Set(Object.values(picks).map((p) => p.id));
  const slot = slots.find((s) => s.key === open);
  const pool = useMemo(() => {
    if (!slot) return [];
    const needle = q.trim().toLowerCase();
    return (teams[lg] || []).filter((t) => !tf || t.id === tf).flatMap((t) => t.players.filter((p) => p.p === slot.pos).map((p) => ({ ...p, t: t.name })))
      .filter((p) => !needle || p.n.toLowerCase().includes(needle)).slice(0, 80);
  }, [slot, teams, lg, q, tf]);

  const choose = (p: P & { t: string }) => { if (!open) return; setPicks((x) => ({ ...x, [open]: { id: p.id, n: p.n, no: p.no, t: p.t, p: p.p } })); setOpen(null); setQ(''); };
  const clear = (k: string) => setPicks((x) => { const n = { ...x }; delete n[k]; return n; });

  const lineup = () => rows.map(([pos], r) => ({ pos, ps: slots.filter((s) => s.row === r).map((s) => picks[s.key]) }));
  const text = () => `BEST 11 ของฉัน (${form})\n${[...lineup()].reverse().map((l) => `${l.pos}: ${l.ps.map((p) => p?.n || '-').join(', ')}`).join('\n')}\n\nสร้างทีมของคุณ 👉 ${location.origin}/football/best11/`;

  const draw = () => {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const font = (w: number, s: number) => `${w} ${s}px "Noto Sans Thai", "Prompt", system-ui, sans-serif`;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#14532d'); bg.addColorStop(1, '#166534'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'; g.fillRect(0, 250 + i * 110, W, 110); }
    g.strokeStyle = 'rgba(255,255,255,.5)'; g.lineWidth = 4; g.strokeRect(50, 250, W - 100, 1010);
    g.beginPath(); g.moveTo(50, 755); g.lineTo(W - 50, 755); g.stroke(); g.beginPath(); g.arc(W / 2, 755, 100, 0, Math.PI * 2); g.stroke();
    g.strokeRect(300, 250, 480, 140); g.strokeRect(300, 1120, 480, 140);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = font(700, 64); g.fillText('BEST 11 ของฉัน', W / 2, 110);
    g.font = font(400, 34); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText(`แผน ${form} · สร้างโดยแฟนบอลไทย`, W / 2, 170);
    const R = rows.length, top = 340, bottom = 1130;
    lineup().forEach((l, r) => {
      const y = R === 1 ? (top + bottom) / 2 : top + (r * (bottom - top)) / (R - 1);
      l.ps.forEach((p, j) => {
        const x = (W * (j + 1)) / (l.ps.length + 1);
        g.beginPath(); g.arc(x, y, 44, 0, Math.PI * 2);
        if (p) { g.fillStyle = '#fff'; g.fill(); g.fillStyle = '#14532d'; g.font = font(700, 36); g.fillText(p.no || '•', x, y + 13); }
        else { g.setLineDash([10, 8]); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 3; g.stroke(); g.setLineDash([]); g.fillStyle = 'rgba(255,255,255,.7)'; g.font = font(600, 28); g.fillText(l.pos, x, y + 10); }
        if (p) {
          let fs = 30; g.font = font(600, fs); let nm = p.n; const max = Math.min(190, W / (l.ps.length + 1) - 12);
          if (g.measureText(nm).width > max) nm = lastName(p.n);
          while (g.measureText(nm).width > max && fs > 20) { fs -= 2; g.font = font(600, fs); } // 글자 크기부터 줄이고, 그래도 넘치면 자름
          while (g.measureText(nm).width > max && nm.length > 3) nm = nm.slice(0, -1);
          g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.55)'; g.strokeText(nm, x, y + 90); g.fillStyle = '#fff'; g.fillText(nm, x, y + 90);
        }
      });
    });
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, H - 90, W, 90); g.fillStyle = '#fff'; g.font = font(600, 34); g.fillText('สร้างทีมของคุณที่ thaibuzz.net/football/best11', W / 2, H - 34);
    return c;
  };
  const toBlob = () => new Promise<Blob | null>((res) => draw().toBlob(res, 'image/png'));
  const save = async () => {
    const b = await toBlob(); if (!b) return;
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'thaibuzz-best11.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const share = async () => {
    const b = await toBlob(); if (!b) return;
    const f = new File([b], 'thaibuzz-best11.png', { type: 'image/png' });
    try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], text: text() }); return; } } catch { return; }
    await save(); setNote('บันทึกรูปแล้ว — นำไปโพสต์ใน Facebook / LINE ได้เลย');
  };
  const copy = async () => { try { await navigator.clipboard.writeText(text()); setNote('คัดลอกรายชื่อแล้ว'); } catch { setNote('คัดลอกไม่ได้ ลองบันทึกรูปแทนนะครับ'); } };

  return (
    <div className="b11">
      <div className="b11-bar">
        <label>แผน <select value={form} onChange={(e) => changeForm(e.target.value)}>{Object.keys(FORMS).map((f) => <option key={f}>{f}</option>)}</select></label>
        <span>เลือกแล้ว <b>{filled}/11</b></span>
        <button type="button" className="b11-reset" onClick={() => setPicks({})} disabled={!filled}>ล้างทั้งหมด</button>
      </div>

      <div className="b11-pitch" role="group" aria-label="สนาม">
        {rows.map(([pos], r) => (
          <div className="b11-row" key={r}>
            {slots.filter((s) => s.row === r).map((s) => {
              const p = picks[s.key];
              return (
                <button key={s.key} type="button" className={`b11-slot${p ? ' on' : ''}`} onClick={() => { setOpen(s.key); setQ(''); setTf(''); }} aria-label={p ? `${p.n} เปลี่ยนตัว` : `เลือก ${POS_TH[s.pos]}`}>
                  <i>{p ? p.no || '•' : '+'}</i>
                  <b>{p ? p.n : POS_TH[s.pos]}</b>
                  {p && <small>{p.t}</small>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="b11-actions">
        <button type="button" onClick={share} disabled={!filled}>📤 แชร์ทีมของฉัน</button>
        <button type="button" onClick={save} disabled={!filled}>💾 บันทึกรูป</button>
        <button type="button" onClick={copy} disabled={!filled}>📋 คัดลอกรายชื่อ</button>
      </div>
      {note && <p className="b11-note" role="status">{note}</p>}

      {slot && (
        <div className="b11-modal" role="dialog" aria-modal="true" aria-label={`เลือก${POS_TH[slot.pos]}`} onClick={(e) => e.target === e.currentTarget && setOpen(null)}>
          <div className="b11-panel">
            <header><h2>เลือก{POS_TH[slot.pos]}</h2><button type="button" onClick={() => setOpen(null)} aria-label="ปิด">✕</button></header>
            <nav className="fb-tabs">{leagues.map((l) => <button key={l.slug} type="button" className="xi-tab" aria-pressed={l.slug === lg} onClick={() => { setLg(l.slug); setTf(''); }}>{l.name}</button>)}</nav>
            <div className="b11-find">
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อนักเตะ (ภาษาอังกฤษ)" aria-label="ค้นหานักเตะ" />
              <select value={tf} onChange={(e) => setTf(e.target.value)} aria-label="ทีม"><option value="">ทุกทีม</option>{(teams[lg] || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
            </div>
            <ul className="b11-list">
              {!teams[lg] && <li className="muted">กำลังโหลดรายชื่อ…</li>}
              {teams[lg] && !pool.length && <li className="muted">ไม่พบนักเตะ</li>}
              {pool.map((p) => (
                <li key={p.id}><button type="button" disabled={used.has(p.id) && picks[open!]?.id !== p.id} onClick={() => choose(p)}><i>{p.no || '•'}</i><b>{p.n}</b><small>{p.t}</small></button></li>
              ))}
            </ul>
            {picks[open!] && <button type="button" className="b11-remove" onClick={() => { clear(open!); setOpen(null); }}>เอา {picks[open!].n} ออกจากทีม</button>}
          </div>
        </div>
      )}
    </div>
  );
}
