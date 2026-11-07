import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { thDay, thTeam, thTime } from '@/lib/football';
import { allMatches, formOf, getMatch, previewText, tableRow, teamByName } from '@/lib/football-match';
import { getPosts, postUrl } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import { MatchPredict } from '@/components/MatchPredict';
import JsonLd from '@/components/JsonLd';

type P = { params: Promise<{ id: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => {
  const ms = allMatches();
  return ms.length ? ms.map((m) => ({ id: m.id })) : [{ id: '0' }]; // output:export 는 빈 목록을 허용하지 않음 (0 은 notFound 처리)
};

const dateStr = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'long', year: 'numeric' });

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const m = getMatch((await params).id);
  if (!m) return { robots: { index: false } };
  const H = thTeam(m.home), A = thTeam(m.away);
  const done = m.status === 'post';
  const title = done ? `ผลบอล ${H} ${m.hs}-${m.as} ${A} ${m.leagueName} (${dateStr(m.date)})` : `${H} พบ ${A} ${m.leagueName} วิเคราะห์ก่อนเตะ ทายผลบอล (${dateStr(m.date)})`;
  const description = done
    ? `ผลบอล ${H} ${m.hs}-${m.as} ${A} ศึก${m.leagueName} ${dateStr(m.date)} พร้อมสถิติตารางคะแนนและผลทายของแฟนบอลไทย`
    : `${H} พบ ${A} ศึก${m.leagueName} เตะ ${dateStr(m.date)} เวลา ${thTime(m.date)} น. (เวลาไทย) ดูตารางคะแนน ฟอร์มล่าสุด และโหวตทายผลกับแฟนบอลไทย เล่นสนุก ไม่มีเงินเดิมพัน`;
  const path = `/football/match/${m.id}/`;
  return { title, description, alternates: { canonical: path }, openGraph: og(path, title, { description }) };
}

export default async function Page({ params }: P) {
  const m = getMatch((await params).id);
  if (!m) notFound();
  const H = thTeam(m.home), A = thTeam(m.away);
  const done = m.status === 'post';
  const hr = tableRow(m.league, m.home), ar = tableRow(m.league, m.away);
  const hf = formOf(m.home), af = formOf(m.away);
  const ht = teamByName(m.home), at = teamByName(m.away);
  const url = `${SITE.url}/football/match/${m.id}/`;
  const news = getPosts().filter((p) => p.category === 'กีฬา' && [m.home, m.away, H, A].some((n) => [p.title, ...p.tags].join(' ').includes(n))).slice(0, 5);
  const pm = { id: m.id, league: m.leagueName, home: H, away: A, date: m.date, status: m.status, hs: m.hs, as: m.as };
  const perGame = (r: { gf: number; ga: number; p: number }) => (r.p ? (r.gf / r.p).toFixed(2) : '-');
  const Form = ({ team, list }: { team: string; list: typeof hf }) => list.length ? (
    <div className="mp-form"><b>{thTeam(team)}</b> {list.map((f) => <span key={f.m.id} className={`mp-${f.r}`} title={`${thTeam(f.m.home)} ${f.m.hs}-${f.m.as} ${thTeam(f.m.away)}`}>{f.r === 'W' ? 'ชนะ' : f.r === 'D' ? 'เสมอ' : 'แพ้'} {f.gf}-{f.ga}</span>)}</div>
  ) : null;
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@graph': [
        { '@type': 'SportsEvent', name: `${m.home} vs ${m.away}`, startDate: m.date, eventStatus: done ? 'https://schema.org/EventCompleted' : 'https://schema.org/EventScheduled', url, sport: 'Association football',
          location: { '@type': 'Place', name: m.venue || m.leagueEn }, organizer: { '@type': 'SportsOrganization', name: m.leagueEn },
          homeTeam: { '@type': 'SportsTeam', name: m.home }, awayTeam: { '@type': 'SportsTeam', name: m.away } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url },
          { '@type': 'ListItem', position: 2, name: 'ตารางบอล', item: `${SITE.url}/football/` },
          { '@type': 'ListItem', position: 3, name: m.leagueName, item: `${SITE.url}/football/${m.league}/` },
          { '@type': 'ListItem', position: 4, name: `${H} พบ ${A}`, item: url },
        ] },
      ] }} />
      <div className="doc fb">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li><a href="/football/">ตารางบอล</a></li><li><a href={`/football/${m.league}/`}>{m.leagueName}</a></li><li>{H} พบ {A}</li></ol></nav>
        <h1>{done ? `ผลบอล ${H} ${m.hs}-${m.as} ${A}` : `${H} พบ ${A} วิเคราะห์ก่อนเตะ`}</h1>
        <p className="lede">{m.leagueName} · {thDay(m.date)} {thTime(m.date)} น. (เวลาไทย){m.venue ? ` · ${m.venue}` : ''}</p>

        <section>
          <h2>{done ? 'ผลการแข่งขัน' : 'ทายผลกับแฟนบอลไทย'}</h2>
          <MatchPredict matches={[pm]} compact />
          <p className="pm-rule">เล่นเพื่อความสนุกเท่านั้น ไม่มีเงินเดิมพัน ไม่มีรางวัล และไม่ใช่คำแนะนำการพนัน</p>
        </section>

        <section>
          <h2>สถานการณ์ก่อนเตะ</h2>
          <p>{previewText(m)}</p>
          {hr && ar && (
            <div className="tbl-wrap">
              <table className="fb-table">
                <thead><tr><th className="tm">ทีม</th><th>อันดับ</th><th>แข่ง</th><th>ชนะ</th><th>เสมอ</th><th>แพ้</th><th>ได้-เสีย</th><th>ยิง/นัด</th><th>แต้ม</th></tr></thead>
                <tbody>{[hr, ar].map((r) => (
                  <tr key={r.team}><td className="tm">{ (r.team === m.home ? ht : at) ? <a href={`/football/team/${(r.team === m.home ? ht : at)!.slug}/`}>{thTeam(r.team)}</a> : thTeam(r.team)}</td><td>{r.rank}</td><td>{r.p}</td><td>{r.w}</td><td>{r.d}</td><td>{r.l}</td><td>{r.gf}-{r.ga}</td><td>{perGame(r)}</td><td><b>{r.pts}</b></td></tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>

        {(hf.length > 0 || af.length > 0) && (
          <section>
            <h2>ฟอร์มล่าสุด</h2>
            <Form team={m.home} list={hf} />
            <Form team={m.away} list={af} />
          </section>
        )}

        {news.length > 0 && (
          <section>
            <h2>ข่าวที่เกี่ยวข้อง</h2>
            <ul className="fb-news">{news.map((p) => <li key={p.slug}><a href={postUrl(p)}>{p.title}</a></li>)}</ul>
          </section>
        )}

        <p className="pm-more">
          ดูต่อ: <a href={`/football/${m.league}/`}>ตารางคะแนน{m.leagueName}</a>
          {ht && <> · <a href={`/football/team/${ht.slug}/`}>นักเตะ{H}</a></>}
          {at && <> · <a href={`/football/team/${at.slug}/`}>นักเตะ{A}</a></>}
          {' · '}<a href="/football/predict/">🎯 ทายผลนัดอื่น</a> · <a href="/football/fan-xi/">🏆 Fan XI</a>
        </p>
        <p className="disc">ข้อมูลอัปเดตอัตโนมัติทุกชั่วโมง เวลาแข่งเป็นเวลาประเทศไทย อาจคลาดเคลื่อนได้หากมีการเลื่อนการแข่งขัน</p>
      </div>
    </>
  );
}
