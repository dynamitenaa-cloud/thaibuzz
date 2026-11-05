'use client';
import { useCallback, useEffect, useState } from 'react';

// Fan XI (4-3-3) 주간 투표: 포지션별 후보에서 정해진 인원까지 고르고(다시 누르면 취소), 현재 득표 상위로 "팬이 뽑은 베스트 11"을 보여줌
type Cand = { id: string; name: string; team: string; note: string };
type League = { slug: string; name: string; matches: number; positions: Record<'GK' | 'DF' | 'MF' | 'FW', Cand[]> };
type Snap = { counts: Record<string, Record<string, number>>; mine: Record<string, number[]>; voters: number };
const POS = [['fw', 'FW', 'กองหน้า', 3], ['mf', 'MF', 'กองกลาง', 3], ['df', 'DF', 'กองหลัง', 4], ['gk', 'GK', 'ผู้รักษาประตู', 1]] as const;

export function FanXI({ round, label, leagues }: { round: string; label: string; leagues: League[] }) {
  const [lg, setLg] = useState(leagues[0]?.slug ?? '');
  const [snap, setSnap] = useState<Snap | null>(null);
  const [dead, setDead] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const cur = leagues.find((l) => l.slug === lg) ?? leagues[0];

  const load = useCallback(() => {
    setSnap(null); setMsg('');
    fetch(`/api/xi?round=${round}&league=${lg}`).then((r) => (r.ok ? r.json() : null)).then((j) => (j ? setSnap(j) : setDead(true))).catch(() => setDead(true));
  }, [round, lg]);
  useEffect(load, [load]);

  const toggle = async (pos: string, cand: number) => {
    if (busy || !snap) return; setBusy(true); setMsg('');
    const on = !snap.mine[pos]?.includes(cand);
    try {
      const r = await fetch('/api/xi', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ round, league: lg, pos, cand, on }) });
      if (r.ok) setSnap(await r.json());
      else if (r.status === 429) setMsg('เลือกครบจำนวนแล้ว กดที่คนเดิมอีกครั้งเพื่อยกเลิกก่อนเลือกคนใหม่');
      else setMsg('ส่งไม่สำเร็จ ลองใหม่อีกครั้งครับ');
    } catch { setMsg('ส่งไม่สำเร็จ ลองใหม่อีกครั้งครับ'); } finally { setBusy(false); }
  };

  if (!cur) return null;
  const top = (key: 'GK' | 'DF' | 'MF' | 'FW', pos: string, n: number) => cur.positions[key]
    .map((c, i) => ({ c, i, v: snap?.counts[pos]?.[i] ?? 0 })).sort((a, b) => b.v - a.v || a.i - b.i).slice(0, n);
  const shareText = snap ? `Fan XI ${cur.name} — ทีมที่แฟนบอลไทยโหวตให้ ${POS.map(([pos, key, th, n]) => `${th}: ${top(key, pos, n).filter((x) => x.v > 0).map((x) => x.c.name).join(', ') || '-'}`).join(' | ')}` : '';

  return (
    <div className="xi-wrap">
      <nav className="fb-tabs" aria-label="ลีก">{leagues.map((l) => <button key={l.slug} type="button" className="xi-tab" aria-pressed={l.slug === lg} onClick={() => setLg(l.slug)}>{l.name}</button>)}</nav>
      <p className="xi-sub">{label} · ผลงานจาก {cur.matches} นัด · เลือกได้ GK 1 · DF 4 · MF 3 · FW 3 {snap && <b>· {snap.voters.toLocaleString('th-TH')} คนโหวตแล้ว</b>}</p>
      {dead && <p className="xi-dead">ระบบโหวตกำลังเตรียมพร้อม ลองกลับมาใหม่ภายหลังนะครับ</p>}
      {msg && <p className="xi-msg" role="alert">{msg}</p>}

      <section className="xi-board" aria-label="ทีม Fan XI ตอนนี้">
        <h2>🏆 Fan XI ตอนนี้ (4-3-3)</h2>
        {POS.map(([pos, key, th, n]) => (
          <div className="xi-line" key={pos}>
            {top(key, pos, n).map(({ c, v }) => <span key={c.id} className={`xi-pl${v ? '' : ' empty'}`}><b>{v ? c.name : '—'}</b><small>{v ? `${c.team} · ${v}` : th}</small></span>)}
          </div>
        ))}
        {shareText && <button type="button" className="xi-copy" onClick={() => navigator.clipboard?.writeText(`${shareText} ${typeof location !== 'undefined' ? location.origin : ''}/football/fan-xi/`)}>คัดลอกผลโหวตไปแชร์</button>}
      </section>

      {POS.slice().reverse().map(([pos, key, th, n]) => (
        <section className="xi-grp" key={pos}>
          <h2>{th} <small>เลือกได้ {n} · เลือกแล้ว {snap?.mine[pos]?.length ?? 0}</small></h2>
          <div className="xi-cands">
            {cur.positions[key].map((c, i) => {
              const on = !!snap?.mine[pos]?.includes(i);
              const v = snap?.counts[pos]?.[i] ?? 0;
              return (
                <button key={c.id} type="button" className={`xi-c${on ? ' on' : ''}`} disabled={!snap || busy} aria-pressed={on} onClick={() => toggle(pos, i)}>
                  <span className="xi-n"><b>{on ? '✓ ' : ''}{c.name}</b><small>{c.team}</small><small>{c.note}</small></span>
                  <span className="xi-v">{v ? v.toLocaleString('th-TH') : ''}</span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
