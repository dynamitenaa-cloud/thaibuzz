import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLeagueData, thDay, thTeam, thTime } from '@/lib/football';
import { allMatches, allTeams, formOf, tableRow } from '@/lib/football-match';
import { getRosters, type Pos } from '@/lib/football-xi';
import { getPosts, postUrl } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import JsonLd from '@/components/JsonLd';

type P = { params: Promise<{ slug: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => {
  const ts = allTeams();
  return ts.length ? ts.map((t) => ({ slug: t.slug })) : [{ slug: 'none' }];
};
const POS: [Pos, string][] = [['GK', 'ผู้รักษาประตู'], ['DF', 'กองหลัง'], ['MF', 'กองกลาง'], ['FW', 'กองหน้า']];
const season = () => { const s = getLeagueData('premier-league')?.season; return s?.match(/\d{4}.\d{2,4}/)?.[0] ?? ''; };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const t = allTeams().find((x) => x.slug === slug);
  if (!t) return { robots: { index: false } };
  const T = thTeam(t.name);
  const title = `รายชื่อนักเตะ${T} ${season()} เบอร์เสื้อ ตารางคะแนน โปรแกรมแข่ง (${t.leagueName})`;
  const description = `รายชื่อนักเตะ${T} (${t.name}) ครบทุกตำแหน่ง พร้อมเบอร์เสื้อ อันดับในตาราง${t.leagueName} ผลการแข่งขันล่าสุด และโปรแกรมนัดต่อไป เวลาไทย`;
  const path = `/football/team/${t.slug}/`;
  return { title, description, alternates: { canonical: path }, openGraph: og(path, title, { description }) };
}

export default async function Page({ params }: P) {
  const { slug } = await params;
  const t = allTeams().find((x) => x.slug === slug);
  if (!t) notFound();
  const T = thTeam(t.name);
  const row = tableRow(t.league, t.name);
  const form = formOf(t.name, 5);
  const next = allMatches().filter((m) => m.status !== 'post' && (m.home === t.name || m.away === t.name)).slice(0, 3);
  const news = getPosts().filter((p) => p.category === 'กีฬา' && [t.name, T].some((n) => [p.title, ...p.tags].join(' ').includes(n))).slice(0, 6);
  const upd = getRosters()?.updatedAt;
  const url = `${SITE.url}/football/team/${t.slug}/`;
  const byNo = (a: { no: string }, b: { no: string }) => (Number(a.no) || 99) - (Number(b.no) || 99);
  const players = t.players.length;
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@graph': [
        { '@type': 'SportsTeam', name: t.name, alternateName: T, sport: 'Association football', url, memberOf: { '@type': 'SportsOrganization', name: t.leagueName } },
        { '@type': 'BreadcrumbList', itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url },
          { '@type': 'ListItem', position: 2, name: 'ตารางบอล', item: `${SITE.url}/football/` },
          { '@type': 'ListItem', position: 3, name: t.leagueName, item: `${SITE.url}/football/${t.league}/` },
          { '@type': 'ListItem', position: 4, name: T, item: url },
        ] },
      ] }} />
      <div className="doc fb">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li><a href="/football/">ตารางบอล</a></li><li><a href={`/football/${t.league}/`}>{t.leagueName}</a></li><li>{T}</li></ol></nav>
        <h1>รายชื่อนักเตะ{T} {season()}</h1>
        <p className="lede">{t.name} · {t.leagueName} · นักเตะในทีม {players} คน{upd ? ` · อัปเดต ${new Date(upd).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })}` : ''}</p>

        {row && <p>{T} อยู่อันดับ <b>{row.rank}</b> ของตาราง{t.leagueName} มี <b>{row.pts}</b> คะแนน จาก {row.p} นัด (ชนะ {row.w} เสมอ {row.d} แพ้ {row.l}) ยิงได้ {row.gf} ประตู เสีย {row.ga} ประตู</p>}

        {next.length > 0 && (
          <section>
            <h2>โปรแกรมนัดต่อไป</h2>
            <ul className="fx-list">{next.map((m) => (
              <li key={m.id} className="fx fx-pre"><span className="fx-t">{thDay(m.date)}</span><span className="fx-h">{thTeam(m.home)}</span><span className="fx-s"><a href={`/football/match/${m.id}/`}>{thTime(m.date)}</a></span><span className="fx-a">{thTeam(m.away)}</span></li>
            ))}</ul>
          </section>
        )}

        {form.length > 0 && (
          <section>
            <h2>ผลการแข่งขันล่าสุด</h2>
            <div className="mp-form">{form.map((f) => <a key={f.m.id} href={`/football/match/${f.m.id}/`} className={`mp-${f.r}`}>{f.r === 'W' ? 'ชนะ' : f.r === 'D' ? 'เสมอ' : 'แพ้'} {f.gf}-{f.ga} · {thTeam(f.m.home === t.name ? f.m.away : f.m.home)}</a>)}</div>
          </section>
        )}

        <section>
          <h2>รายชื่อนักเตะ{T}</h2>
          {POS.map(([p, label]) => {
            const list = t.players.filter((x) => x.p === p).sort(byNo);
            return list.length ? (
              <div key={p}>
                <h3>{label} ({list.length})</h3>
                <ul className="tm-players">{list.map((x) => <li key={x.id}>{x.no && <b>{x.no}</b>} {x.n}</li>)}</ul>
              </div>
            ) : null;
          })}
          <p className="disc">รายชื่ออัปเดตอัตโนมัติจากข้อมูลสาธารณะ อาจไม่ตรงกับทะเบียนนักเตะล่าสุดหากมีการย้ายทีมระหว่างช่วงตลาดซื้อขาย</p>
        </section>

        {news.length > 0 && (
          <section>
            <h2>ข่าว{T}ล่าสุด</h2>
            <ul className="fb-news">{news.map((p) => <li key={p.slug}><a href={postUrl(p)}>{p.title}</a></li>)}</ul>
          </section>
        )}

        <p className="pm-more">ดูต่อ: <a href={`/football/${t.league}/`}>ตารางคะแนน{t.leagueName}</a> · <a href="/football/best11/">⚽ สร้าง BEST 11 ของคุณ</a> · <a href="/football/predict/">🎯 ทายผลบอล</a></p>
      </div>
    </>
  );
}
