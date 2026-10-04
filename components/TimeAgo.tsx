'use client';
import { useEffect, useState } from 'react';

const rtf = new Intl.RelativeTimeFormat('th', { numeric: 'auto' });

function rel(iso: string) {
  const s = (Date.parse(iso) - Date.now()) / 1000;
  const abs = Math.abs(s);
  if (abs < 60) return 'เมื่อสักครู่';
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (abs < 86400 * 7) return rtf.format(Math.round(s / 86400), 'day');
  return null;
}

// static export: ค่าเริ่มต้นเป็นวันที่แบบคงที่ แล้วเปลี่ยนเป็น "x นาทีที่แล้ว" ฝั่ง client
export default function TimeAgo({ iso, fallback }: { iso: string; fallback: string }) {
  const [txt, setTxt] = useState(fallback);
  useEffect(() => {
    const tick = () => setTxt(rel(iso) ?? fallback);
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, [iso, fallback]);
  return <time dateTime={iso} title={fallback}>{txt}</time>;
}
