import type { Metadata } from 'next';
import { og } from '@/lib/og';
import SearchClient from './SearchClient';

export const metadata: Metadata = { title: 'ค้นหาข่าว', robots: { index: false, follow: true }, alternates: { canonical: '/search/' }, openGraph: og('/search/', 'ค้นหาข่าว') };

export default function Page() {
  return (
    <div style={{ maxWidth: 860 }}>
      <div className="ph"><h1>ค้นหาข่าว</h1><p>ค้นหาจากชื่อคนดัง ซีรีส์ แท็ก หรือคีย์เวิร์ดที่กำลังเป็นกระแส</p></div>
      <SearchClient />
    </div>
  );
}
