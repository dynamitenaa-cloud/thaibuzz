'use client';
import { useEffect, useState } from 'react';

// 경기 결과 예측 (홈승/무/원정승). 투표는 POST /api/engage (slug = m<ESPN 경기 ID>), 집계는 GET /api/matches
// 킥오프 후에는 버튼 대신 결과 막대만 보이고, 종료된 경기는 실제 결과와 "맞힌 비율"을 보여줌. 상금·배당 없음(재미용)
export type PM = { id: string; league: string; home: string; away: string; date: string; status: 'pre' | 'in' | 'post'; hs: string; as: string };
type Snap = { votes: number[]; mine: number | null };

const day = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' });
const time = (iso: string) => new Date(iso).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
const outcome = (m: PM) => (Number(m.hs) > Number(m.as) ? 0 : Number(m.hs) < Number(m.as) ? 2 : 1);

export function MatchPredict({ matches }: { matches: PM[] }) {
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

  const up = matches.filter((m) => m.status !== 'post');
  const past = matches.filter((m) => m.status === 'post');
  return (
    <div className="pm-wrap">
      {mine.length > 0 && <p className="pm-score">🎯 คุณทายถูก <b>{hit}/{mine.length}</b> นัดที่จบแล้ว</p>}
      <h2>นัดที่กำลังจะแข่ง</h2>
      {up.length ? <ul className="pm-list">{up.map(card)}</ul> : <p>ยังไม่มีโปรแกรมใหม่ ลองกลับมาดูอีกครั้งก่อนวันแข่ง</p>}
      {past.length > 0 && (<><h2>ผลที่ผ่านมา</h2><ul className="pm-list">{past.map(card)}</ul></>)}
    </div>
  );
}
