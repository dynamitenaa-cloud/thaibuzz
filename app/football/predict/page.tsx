import type { Metadata } from 'next';
import { getLeagueData, LEAGUES, thTeam, type Match } from '@/lib/football';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import { MatchPredict, type PM } from '@/components/MatchPredict';
import JsonLd from '@/components/JsonLd';

export const dynamic = 'force-static';
const title = 'ทายผลบอลก่อนเตะ ใครจะชนะ? โหวตกับแฟนบอลไทย พรีเมียร์ลีก ลาลีกา เซเรีย อา บุนเดสลีกา UCL';
export const metadata: Metadata = {
  title,
  description: 'ทายผลบอลคืนนี้ฟรี กดเลือกทีมที่คิดว่าชนะ แล้วดูว่าแฟนบอลไทยคนอื่นทายยังไง พร้อมสรุปว่านัดที่จบแล้วใครทายถูกกี่เปอร์เซ็นต์ เล่นเพื่อความสนุก ไม่มีเงินเดิมพัน',
  alternates: { canonical: '/football/predict/' },
  openGraph: og('/football/predict/', title),
};

export default function Page() {
  const now = Date.now();
  const rows: PM[] = LEAGUES.flatMap((l) => {
    const d = getLeagueData(l.slug);
    return d ? [...d.fixtures, ...d.results].map((m: Match) => ({ id: m.id, league: l.name, home: thTeam(m.home), away: thTeam(m.away), date: m.date, status: m.status, hs: m.hs, as: m.as })) : [];
  });
  const uniq = [...new Map(rows.map((m) => [m.id, m])).values()];
  const upcoming = uniq.filter((m) => m.status !== 'post' && Date.parse(m.date) < now + 7 * 864e5).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 24);
  const past = uniq.filter((m) => m.status === 'post' && Date.parse(m.date) > now - 4 * 864e5).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url }, { '@type': 'ListItem', position: 2, name: 'ตารางบอล', item: `${SITE.url}/football/` }, { '@type': 'ListItem', position: 3, name: 'ทายผลบอล', item: `${SITE.url}/football/predict/` }] }} />
      <div className="doc fb">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li><a href="/football/">ตารางบอล</a></li><li>ทายผลบอล</li></ol></nav>
        <h1>🎯 ทายผลบอลก่อนเตะ</h1>
        <p className="lede">กดเลือกทีมที่คิดว่าชนะ (หรือเสมอ) ก่อนเตะ แล้วดูว่าแฟนบอลไทยคนอื่นทายยังไง พอนัดจบจะบอกว่ามีกี่เปอร์เซ็นต์ที่ทายถูก เวลาไทย อัปเดตอัตโนมัติ</p>
        <p className="pm-rule">เล่นเพื่อความสนุกเท่านั้น ไม่มีเงินเดิมพัน ไม่มีรางวัล และไม่ใช่คำแนะนำการพนัน · ไม่ต้องสมัครสมาชิก</p>
        <MatchPredict matches={[...upcoming, ...past]} />
        <p className="pm-more">เล่นต่อ: <a href="/football/fan-xi/">🏆 โหวต Fan XI ประจำสัปดาห์</a> · <a href="/football/best11/">⚽ สร้าง BEST 11 ของคุณ</a></p>
      </div>
    </>
  );
}
