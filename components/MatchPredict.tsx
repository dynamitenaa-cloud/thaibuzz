'use client';
import { useEffect, useState } from 'react';

// 경기 결과 예측 (홈승/무/원정승). 투표는 POST /api/engage (slug = m<ESPN 경기 ID>), 집계는 GET /api/matches
// 킥오프 후에는 버튼 대신 결과 막대만 보이고, 종료된 경기는 실제 결과와 "맞힌 비율"을 보여줌. 상금·배당 없음(재미용)
export type PM = { id: string; league: string; home: string; away: string; date: string; status: 'pre' | 'in' | 'post'; hs: string; as: string };
type Snap = { votes: number[]; mine: number | null };

const day = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const outcome = (m: PM) => (Number(m.hs) > Number(m.as) ? 0 : Number(m.hs) < Number(m.as) ? 2 : 1);

export function MatchPredict({ matches, compact = false }: { matches: PM[]; compact?: boolean }) {
  const [data, setData] = useState<Record<string, Snap> | null>(null);
  const [dead, setDead] = useState(false);
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState('');

  useEffect(() => {
    setNow(Date.now());
    if (!matches.length) return;
    fetch(`/api/matches?ids=${matches.map((m) => `m${m.id}`).join(',')}`).then((r) => (r.ok ? r.json() : null)).then((j) => (j ? setData(j) : setDead(true))).catch(() => setDead(true));
  }, [matches]);

  const vote = async (m: PM, opt: number) => {
    if (busy) return; setBusy(m.id);
    try {
      const r = await fetch('/api/engage', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: `m${m.id}`, type: 'vote', opt }) });
      if (r.ok) { const s = await r.json(); setData((d) => ({ ...(d || {}), [`m${m.id}`]: { votes: s.votes, mine: s.mine?.vote ?? null } })); }
    } catch {} finally { setBusy(''); }
  };

  // 내가 맞힌 경기 (종료된 경기 중 내가 투표한 것)
  const mine = matches.filter((m) => m.status === 'post' && data?.[`m${m.id}`]?.mine != null);
  const hit = mine.filter((m) => data![`m${m.id}`].mine === outcome(m)).length;

  // 내 성적 카드 (공유용 PNG). 종료된 경기 중 내가 투표한 것 최대 6개
  const [note, setNote] = useState('');
  const drawCard = () => {
    const W = 1080, H = 1080, c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d')!;
    const font = (w: number, z: number) => `${w} ${z}px "Noto Sans Thai", "Prompt", system-ui, sans-serif`;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, '#14532d'); bg.addColorStop(1, '#0f3d22'); g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = font(700, 58); g.fillText('ผลทายบอลของฉัน', W / 2, 105);
    g.font = font(800, 190); g.fillStyle = '#fde047'; g.fillText(`${hit}/${mine.length}`, W / 2, 310);
    g.font = font(500, 38); g.fillStyle = 'rgba(255,255,255,.9)'; g.fillText(`ทายถูก ${hit} จาก ${mine.length} นัดที่จบแล้ว`, W / 2, 375);
    g.textAlign = 'left';
    const list = [...mine].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6);
    list.forEach((m, i) => {
      const y = 470 + i * 88, ok = data![`m${m.id}`].mine === outcome(m);
      g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(60, y - 52, W - 120, 74);
      g.fillStyle = ok ? '#86efac' : '#fca5a5'; g.font = font(700, 40); g.fillText(ok ? '✓' : '✗', 84, y);
      g.fillStyle = '#fff'; let z = 32; g.font = font(600, z); const t = `${m.home} ${m.hs}-${m.as} ${m.away}`;
      while (g.measureText(t).width > W - 260 && z > 20) { z -= 2; g.font = font(600, z); }
      g.fillText(t, 140, y);
    });
    g.textAlign = 'center'; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, H - 90, W, 90); g.fillStyle = '#fff'; g.font = font(600, 34); g.fillText('ทายผลบอลกับแฟนบอลไทย thaibuzz.net/football/predict', W / 2, H - 34);
    return c;
  };
  const shareCard = async () => {
    const b = await new Promise<Blob | null>((res) => drawCard().toBlob(res, 'image/png')); if (!b) return;
    const f = new File([b], 'thaibuzz-predict.png', { type: 'image/png' });
    const text = `ฉันทายบอลถูก ${hit}/${mine.length} นัด! มาทายกัน 👉 ${location.origin}/football/predict/`;
    try { if (navigator.canShare?.({ files: [f] })) { await navigator.share({ files: [f], text }); return; } } catch { return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'thaibuzz-predict.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    setNote('บันทึกรูปแล้ว — นำไปโพสต์ใน Facebook / LINE ได้เลย');
  };

  // 컴포넌트가 아니라 함수로 호출 (안에서 정의한 컴포넌트는 state 가 바뀔 때마다 통째로 다시 만들어져 깜빡임/포커스 손실이 생김)
  const card = (m: PM) => {
    const s = data?.[`m${m.id}`];
    const total = s ? s.votes.reduce((a, b) => a + b, 0) : 0;
    const open = m.status === 'pre' && now > 0 && Date.parse(m.date) > now && !dead;
    const show = !!s && total > 0 && (s.mine != null || !open); // 아직 아무도 안 맞혔으면 0% 막대 대신 이름만
    const done = m.status === 'post';
    const win = done ? outcome(m) : -1;
    const labels = [m.home, 'เสมอ', m.away];
    return (
      <li key={m.id} className={`pm pm-${m.status}`}>
        <div className="pm-h"><small>{m.league} · {day(m.date)} {time(m.date)} น.</small>{done && <b className="pm-final">จบ {m.hs} - {m.as}</b>}{m.status === 'in' && <b className="pm-live">กำลังแข่ง {m.hs} - {m.as}</b>}</div>
        <div className="pm-teams"><span>{m.home}</span><i>vs</i><span>{m.away}</span></div>
        <div className="pm-opts" role="group" aria-label={`ทายผล ${m.home} พบ ${m.away}`}>
          {labels.map((l, i) => {
            const n = s?.votes[i] ?? 0;
            const pct = total ? Math.round((n / total) * 100) : 0;
            return (
              <button key={i} type="button" className={`pm-opt${show ? ' done' : ''}${s?.mine === i ? ' mine' : ''}${win === i ? ' win' : ''}`} disabled={!open || s?.mine != null || busy === m.id || !s} onClick={() => vote(m, i)} aria-pressed={s?.mine === i}>
                {show && <span className="bar" style={{ height: `${pct}%` }} />}
                <span className="lbl">{s?.mine === i ? '✓ ' : ''}{i === 1 ? l : i === 0 ? `${l} ชนะ` : `${l} ชนะ`}</span>
                {show && <b>{pct}%</b>}
              </button>
            );
          })}
        </div>
        <small className="pm-note">
          {dead ? 'ระบบทายผลกำลังเตรียมพร้อม' : !s ? ' ' : done ? (total ? `ผู้ทายถูก ${Math.round((s.votes[win] / total) * 100)}% จาก ${total.toLocaleString('th-TH')} คน${s.mine != null ? (s.mine === win ? ' · คุณทายถูก 🎯' : ' · คุณทายผิด') : ''}` : 'ไม่มีผู้ทายนัดนี้') : open ? (s.mine != null ? `ขอบคุณที่ทายผล · ${total.toLocaleString('th-TH')} คน` : total ? `${total.toLocaleString('th-TH')} คนทายแล้ว — กดเพื่อทายและดูผล` : 'เป็นคนแรกที่ทาย!') : `ปิดรับทายผลแล้ว · ${total.toLocaleString('th-TH')} คน`}
        </small>
      </li>
    );
  };

  if (compact) return <div className="pm-wrap pm-compact"><ul className="pm-list">{matches.map(card)}</ul></div>; // 경기 프리뷰 페이지용: 제목 없이 카드만
  const up = matches.filter((m) => m.status !== 'post');
  const past = matches.filter((m) => m.status === 'post');
  return (
    <div className="pm-wrap">
      {mine.length > 0 && <p className="pm-score">🎯 คุณทายถูก <b>{hit}/{mine.length}</b> นัดที่จบแล้ว <button type="button" className="pm-share" onClick={shareCard}>📤 แชร์คะแนน</button>{note && <small> {note}</small>}</p>}
      <h2>นัดที่กำลังจะแข่ง</h2>
      {up.length ? <ul className="pm-list">{up.map(card)}</ul> : <p>ยังไม่มีโปรแกรมใหม่ ลองกลับมาดูอีกครั้งก่อนวันแข่ง</p>}
      {past.length > 0 && (<><h2>ผลที่ผ่านมา</h2><ul className="pm-list">{past.map(card)}</ul></>)}
    </div>
  );
}
