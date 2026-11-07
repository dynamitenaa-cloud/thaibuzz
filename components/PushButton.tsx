'use client';
import { useEffect, useState } from 'react';

// 웹 푸시 구독 버튼 (축구 페이지용). 알림은 주 2~3회 (Fan XI 투표 시작, BEST 11, 주말 경기 예측, 결과)
// 공개키는 edge/api/push-send.js 의 PUBLIC 과 같아야 함
const KEY = 'BOYBztoyPlc3HoVpOVf_trImPkpB4eWRf_9jrn-AR5N1tdN4283pR0WP9yxu7MaZdBSHf3jhveYW17vg8z3A-JM';
const toBytes = (s: string) => { const p = '='.repeat((4 - (s.length % 4)) % 4); const r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(r, (c) => c.charCodeAt(0)); };

type S = 'hidden' | 'off' | 'on' | 'busy' | 'denied';
export function PushButton() {
  const [s, setS] = useState<S>('hidden');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return;
    if (Notification.permission === 'denied') { setS('denied'); return; }
    navigator.serviceWorker.getRegistration('/sw.js').then((r) => r?.pushManager.getSubscription()).then((sub) => setS(sub ? 'on' : 'off')).catch(() => setS('off'));
  }, []);

  const on = async () => {
    setS('busy'); setMsg('');
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') { setS(perm === 'denied' ? 'denied' : 'off'); return; }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) }));
      const r = await fetch('/api/push', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) });
      if (!r.ok) throw new Error(String(r.status));
      setS('on'); setMsg('เปิดแจ้งเตือนแล้ว 🎉');
    } catch { setS('off'); setMsg('เปิดแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง'); }
  };
  const off = async () => {
    setS('busy');
    try {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await fetch('/api/push', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {}); await sub.unsubscribe(); }
    } finally { setS('off'); setMsg('ปิดแจ้งเตือนแล้ว'); }
  };

  if (s === 'hidden') return null;
  return (
    <div className="push-box">
      {s === 'denied' ? <small>การแจ้งเตือนถูกปิดในเบราว์เซอร์ — เปิดได้ที่การตั้งค่าเว็บไซต์</small> : s === 'on' ? (
        <button type="button" className="push-btn on" onClick={off}>🔔 เปิดแจ้งเตือนอยู่ (กดเพื่อปิด)</button>
      ) : (
        <button type="button" className="push-btn" onClick={on} disabled={s === 'busy'}>🔔 แจ้งเตือนเมื่อมีโหวต/ทายผลใหม่</button>
      )}
      <small>{msg || 'ไม่เกินสัปดาห์ละ 2–3 ครั้ง ปิดได้ทุกเมื่อ'}</small>
    </div>
  );
}
