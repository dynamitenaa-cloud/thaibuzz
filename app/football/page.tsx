import type { Metadata } from 'next';
import { getLeagueData, LEAGUES, thTeam, thTime, thDay, todayTh, type Match } from '@/lib/football';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import JsonLd from '@/components/JsonLd';

export const dynamic = 'force-static';
const title = `ตารางบอล ผลบอล โปรแกรมบอลวันนี้ ${todayTh()} พรีเมียร์ลีก ลาลีกา เซเรีย อา บุนเดสลีกา UCL`;
export const metadata: Metadata = {
  title,
  description: 'ตารางคะแนนบอลลีกดังล่าสุด ผลบอลเมื่อคืน และโปรแกรมบอลวันนี้ เวลาไทย ทั้งพรีเมียร์ลีก ลาลีกา กัลโช่ เซเรีย อา บุนเดสลีกา และยูฟ่า แชมเปียนส์ลีก อัปเดตทุกชั่วโมง',
  alternates: { canonical: '/football/' },
  openGraph: og('/football/', title),
};

export default function Page() {
  const all = LEAGUES.map((l) => ({ l, d: getLeagueData(l.slug) })).filter((x) => x.d);
  // 유럽 경기는 태국 시간 밤~새벽 → "오늘"이 아니라 지금부터 30시간 안의 경기 (진행 중 포함)
  const now = Date.now();
  const todayGames = all.flatMap(({ l, d }) => d!.fixtures.filter((m) => m.status === 'in' || (Date.parse(m.date) - now < 30 * 36e5 && Date.parse(m.date) > now - 3 * 36e5)).map((m) => ({ l, m }))).sort((a, b) => a.m.date.localeCompare(b.m.date));
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url }, { '@type': 'ListItem', position: 2, name: 'ตารางบอล', item: `${SITE.url}/football/` }] }} />
      <div className="doc fb">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li>ตารางบอล</li></ol></nav>
        <h1>ตารางบอล ผลบอล โปรแกรมบอลวันนี้</h1>
        <p className="lede">ตารางคะแนนและโปรแกรมบอล 5 ลีกดัง เวลาไทย อัปเดตอัตโนมัติทุกชั่วโมง</p>
        <nav className="fb-tabs" aria-label="ลีก">{LEAGUES.map((x) => <a key={x.slug} href={`/football/${x.slug}/`}>{x.name}</a>)}</nav>

        <section>
          <h2>โปรแกรมบอลคืนนี้ - พรุ่งนี้ (เวลาไทย)</h2>
          {todayGames.length ? (
            <ul className="fx-list">{todayGames.map(({ l, m }: { l: (typeof LEAGUES)[number]; m: Match }) => (
              <li key={m.id} className={`fx fx-${m.status}`}>
                <span className="fx-t">{m.status === 'pre' ? thTime(m.date) : m.status === 'in' ? 'สด' : 'จบ'}</span>
                <span className="fx-h">{thTeam(m.home)}</span>
                <span className="fx-s">{m.status === 'pre' ? 'vs' : `${m.hs} - ${m.as}`}</span>
                <span className="fx-a">{thTeam(m.away)}</span>
                <small className="fx-l">{l.name} · {thDay(m.date)}</small>
              </li>
            ))}</ul>
          ) : <p>ช่วงนี้ไม่มีโปรแกรมใน 5 ลีกหลัก ดูนัดถัดไปได้ในหน้าของแต่ละลีก</p>}
        </section>

        {all.map(({ l, d }) => (
          <section key={l.slug}>
            <h2><a href={`/football/${l.slug}/`}>ตารางคะแนน{l.name}</a></h2>
            <table className="fb-table mini">
              <thead><tr><th>#</th><th className="tm">ทีม</th><th>แข่ง</th><th>แต้ม</th></tr></thead>
              <tbody>{d!.table.slice(0, 6).map((r) => <tr key={r.team}><td>{r.rank}</td><td className="tm">{thTeam(r.team)}</td><td>{r.p}</td><td><b>{r.pts}</b></td></tr>)}</tbody>
            </table>
            <p><a href={`/football/${l.slug}/`} style={{ textDecoration: 'underline' }}>ดูตารางเต็ม ผลบอล และโปรแกรม{l.name} ›</a></p>
          </section>
        ))}
      </div>
    </>
  );
}
