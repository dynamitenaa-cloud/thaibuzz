import type { Metadata } from 'next';
import { CITIES, getWeather, pm, r0, sky, todayTh } from '@/lib/weather';
import { getPosts, postUrl } from '@/lib/posts';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import JsonLd from '@/components/JsonLd';

export const dynamic = 'force-static';

export function generateMetadata(): Metadata {
  const w = getWeather();
  const bkk = w.cities.find((c) => c.slug === 'bangkok');
  const title = `สภาพอากาศวันนี้ ${todayTh()} พยากรณ์อากาศ 7 วัน ฝนตกไหม ค่าฝุ่น PM2.5 ทั่วไทย`;
  const description = bkk
    ? `สภาพอากาศวันนี้ กรุงเทพฯ ${sky(bkk.days[0]?.code ?? bkk.current.code).t} อุณหภูมิ ${r0(bkk.days[0]?.min ?? 0)}-${r0(bkk.days[0]?.max ?? 0)}°C โอกาสฝนตก ${bkk.days[0]?.rainProb ?? 0}% พร้อมพยากรณ์อากาศ 7 วันและค่าฝุ่น PM2.5 ${CITIES.length} เมืองทั่วไทย อัปเดตทุกชั่วโมง`
    : 'สภาพอากาศวันนี้ พยากรณ์อากาศ 7 วัน และค่าฝุ่น PM2.5 เมืองหลักทั่วไทย อัปเดตทุกชั่วโมง';
  return { title, description, alternates: { canonical: '/weather/' }, openGraph: og('/weather/', title, { description }), robots: w.cities.length ? undefined : { index: false } };
}

export default function Page() {
  const w = getWeather();
  if (!w.cities.length) return <div className="empty"><b>⛅</b><p>กำลังรวบรวมข้อมูล… กลับมาอีกครั้งเร็ว ๆ นี้</p></div>;
  const news = getPosts().filter((p) => /กรมอุตุ|พายุ|ฝนตก|น้ำท่วม|อากาศหนาว|ฝุ่น|PM2\.5|มรสุม/i.test([p.title, ...p.tags].join(' '))).slice(0, 6);
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url }, { '@type': 'ListItem', position: 2, name: 'สภาพอากาศ', item: `${SITE.url}/weather/` }] }} />
      <div className="doc wx">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li>สภาพอากาศ</li></ol></nav>
        <h1>สภาพอากาศวันนี้ {todayTh()}</h1>
        <p className="lede">อุณหภูมิ โอกาสฝนตก และค่าฝุ่น PM2.5 เมืองหลักทั่วไทย อัปเดต {new Date(w.updatedAt).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })} น.</p>
        <div className="wx-grid">
          {CITIES.map((c) => {
            const d = w.cities.find((x) => x.slug === c.slug);
            if (!d) return null;
            const t = d.days[0];
            const s = sky(t?.code ?? d.current.code);
            const p = pm(d.current.pm25);
            return (
              <a key={c.slug} href={`/weather/${c.slug}/`} className="wx-card">
                <b>{c.name}</b>
                <span className="wx-now"><span className="wx-e">{s.e}</span>{r0(d.current.temp)}°</span>
                <small>{s.t}</small>
                <small>{r0(t.min)}°–{r0(t.max)}° · ฝน {t.rainProb}%</small>
                <small style={{ color: p.c }}>PM2.5 {d.current.pm25 != null ? r0(d.current.pm25) : '-'} · {p.t}</small>
              </a>
            );
          })}
        </div>
        {news.length > 0 && (
          <section>
            <h2>ข่าวสภาพอากาศล่าสุด</h2>
            <ul className="fb-news">{news.map((p) => <li key={p.slug}><a href={postUrl(p)}>{p.title}</a></li>)}</ul>
          </section>
        )}
        <p className="disc">ข้อมูลพยากรณ์จาก Open-Meteo (แบบจำลองสภาพอากาศ) อัปเดตอัตโนมัติ ใช้เพื่อการอ้างอิง ประกาศเตือนภัยอย่างเป็นทางการโปรดติดตามกรมอุตุนิยมวิทยา</p>
      </div>
    </>
  );
}
