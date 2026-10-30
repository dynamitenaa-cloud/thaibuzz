import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeagueData, LEAGUES, leagueBySlug, thDay, thDayKey, thTeam, thTime, todayTh, type Match } from '@/lib/football';
import { getPosts, postUrl } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import JsonLd from '@/components/JsonLd';

type P = { params: Promise<{ league: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => LEAGUES.map((l) => ({ league: l.slug }));

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const l = leagueBySlug((await params).league);
  const d = l && getLeagueData(l.slug);
  if (!l || !d) return { robots: { index: false } };
  const lead = d.table[0];
  const title = `ตารางคะแนน${l.name} ${d.season.match(/\d{4}.\d{2,4}/)?.[0] ?? ''} ล่าสุด ผลบอล โปรแกรมบอล (${todayTh()})`;
  const description = `ตารางคะแนน${l.name}ล่าสุด${lead ? ` ${thTeam(lead.team)} นำเป็นจ่าฝูง ${lead.pts} คะแนน` : ''} พร้อมผลบอลเมื่อคืน และโปรแกรมบอล${l.name}นัดต่อไป เวลาไทย อัปเดตทุกชั่วโมง`;
  const path = `/football/${l.slug}/`;
  return { title, description, alternates: { canonical: path }, openGraph: og(path, title, { description }) };
}

const MatchRow = ({ m }: { m: Match }) => (
  <li className={`fx fx-${m.status}`}>
    <span className="fx-t">{m.status === 'pre' ? thTime(m.date) : m.status === 'in' ? 'สด' : 'จบ'}</span>
    <span className="fx-h">{thTeam(m.home)}</span>
    <span className="fx-s">{m.status === 'pre' ? 'vs' : `${m.hs} - ${m.as}`}</span>
    <span className="fx-a">{thTeam(m.away)}</span>
  </li>
);

function ByDay({ list }: { list: Match[] }) {
  const days = [...new Set(list.map((m) => thDayKey(m.date)))];
  return (
    <>
      {days.map((k) => {
        const ms = list.filter((m) => thDayKey(m.date) === k);
        return (
          <div key={k} className="fx-day">
            <h3>{thDay(ms[0].date)}</h3>
            <ul className="fx-list">{ms.map((m) => <MatchRow key={m.id} m={m} />)}</ul>
          </div>
        );
      })}
    </>
  );
}

export default async function Page({ params }: P) {
  const l = leagueBySlug((await params).league);
  if (!l) notFound();
  const d = getLeagueData(l.slug);
  if (!d) return <div className="empty"><b>⚽</b><p>กำลังรวบรวมข้อมูล… กลับมาอีกครั้งเร็ว ๆ นี้</p></div>;
  const live = d.fixtures.filter((m) => m.status === 'in');
  const upcoming = d.fixtures.filter((m) => m.status === 'pre').slice(0, 20);
  const results = [...d.results].reverse().slice(0, 20);
  const news = getPosts().filter((p) => p.category === 'กีฬา' && l.tags.test([p.title, ...p.tags].join(' '))).slice(0, 8);
  const url = `${SITE.url}/football/${l.slug}/`;
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@graph': [
        { '@type': 'WebPage', name: `ตารางคะแนน${l.name}`, url, dateModified: d.updatedAt, isPartOf: { '@id': `${SITE.url}/#web` }, about: l.en },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url },
          { '@type': 'ListItem', position: 2, name: 'ตารางบอล', item: `${SITE.url}/football/` },
          { '@type': 'ListItem', position: 3, name: l.name, item: url },
        ] },
      ] }} />
      <div className="doc fb">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li><a href="/football/">ตารางบอล</a></li><li>{l.name}</li></ol></nav>
        <h1>ตารางคะแนน{l.name} ล่าสุด</h1>
        <p className="lede">{d.season} · อัปเดต {new Date(d.updatedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })} น. (เวลาไทย)</p>
        <nav className="fb-tabs" aria-label="ลีกอื่น">{LEAGUES.map((x) => <a key={x.slug} href={`/football/${x.slug}/`} aria-current={x.slug === l.slug ? 'page' : undefined}>{x.name}</a>)}</nav>

        {live.length > 0 && (<section><h2>🔴 กำลังแข่ง</h2><ul className="fx-list">{live.map((m) => <MatchRow key={m.id} m={m} />)}</ul></section>)}

        <section>
          <h2>ตารางคะแนน{l.name}</h2>
          <div className="tbl-wrap">
            <table className="fb-table">
              <thead><tr><th>#</th><th className="tm">ทีม</th><th>แข่ง</th><th>ชนะ</th><th>เสมอ</th><th>แพ้</th><th>ได้-เสีย</th><th>แต้ม</th></tr></thead>
              <tbody>{d.table.map((r) => (
                <tr key={r.team}><td>{r.rank}</td><td className="tm">{thTeam(r.team)}</td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gd > 0 ? `+${r.gd}` : r.gd}</td><td><b>{r.pts}</b></td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        {upcoming.length > 0 && (<section><h2>โปรแกรมบอล{l.name} นัดต่อไป</h2><ByDay list={upcoming} /></section>)}
        {results.length > 0 && (<section><h2>ผลบอล{l.name} ล่าสุด</h2><ByDay list={results} /></section>)}

        {news.length > 0 && (
          <section>
            <h2>ข่าว{l.name}ล่าสุด</h2>
            <ul className="fb-news">{news.map((p) => <li key={p.slug}><a href={postUrl(p)}>{p.title}</a></li>)}</ul>
          </section>
        )}
        <p className="disc">ข้อมูลตารางคะแนนและผลการแข่งขันอัปเดตอัตโนมัติทุกชั่วโมง เวลาแข่งเป็นเวลาประเทศไทย อาจคลาดเคลื่อนได้หากมีการเลื่อนการแข่งขัน</p>
      </div>
    </>
  );
}
