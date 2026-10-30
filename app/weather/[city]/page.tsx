import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CITIES, cityBySlug, dayName, getWeather, pm, r0, sky, todayTh } from '@/lib/weather';
import { SITE } from '@/lib/site';
import { og } from '@/lib/og';
import JsonLd from '@/components/JsonLd';

type P = { params: Promise<{ city: string }> };
export const dynamicParams = false;
export const generateStaticParams = () => CITIES.map((c) => ({ city: c.slug }));

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const c = cityBySlug((await params).city);
  const d = c && getWeather().cities.find((x) => x.slug === c.slug);
  if (!c || !d) return { robots: { index: false } };
  const t = d.days[0];
  const title = `สภาพอากาศ${c.name}วันนี้ (${todayTh()}) พยากรณ์อากาศ 7 วัน ฝนตกไหม ค่าฝุ่น PM2.5`;
  const description = `สภาพอากาศ${c.full}วันนี้ ${sky(t.code).t} อุณหภูมิ ${r0(t.min)}-${r0(t.max)}°C โอกาสฝนตก ${t.rainProb}% ค่าฝุ่น PM2.5 ${d.current.pm25 != null ? r0(d.current.pm25) : '-'} µg/m³ พร้อมพยากรณ์อากาศล่วงหน้า 7 วัน`;
  const path = `/weather/${c.slug}/`;
  return { title, description, alternates: { canonical: path }, openGraph: og(path, title, { description }) };
}

export default async function Page({ params }: P) {
  const c = cityBySlug((await params).city);
  if (!c) notFound();
  const d = getWeather().cities.find((x) => x.slug === c.slug);
  if (!d) return <div className="empty"><b>⛅</b><p>กำลังรวบรวมข้อมูล…</p></div>;
  const now = sky(d.current.code);
  const p = pm(d.current.pm25);
  const t = d.days[0];
  const rainDays = d.days.filter((x) => x.rainProb >= 60).map((x) => dayName(x.date));
  return (
    <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'หน้าแรก', item: SITE.url },
        { '@type': 'ListItem', position: 2, name: 'สภาพอากาศ', item: `${SITE.url}/weather/` },
        { '@type': 'ListItem', position: 3, name: c.name, item: `${SITE.url}/weather/${c.slug}/` },
      ] }} />
      <div className="doc wx">
        <nav className="crumbs" aria-label="breadcrumb"><ol><li><a href="/">หน้าแรก</a></li><li><a href="/weather/">สภาพอากาศ</a></li><li>{c.name}</li></ol></nav>
        <h1>สภาพอากาศ{c.name}วันนี้</h1>
        <p className="lede">{c.full} · อัปเดต {new Date(d.fetchedAt).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' })} น.</p>
        <nav className="fb-tabs" aria-label="เมืองอื่น">{CITIES.map((x) => <a key={x.slug} href={`/weather/${x.slug}/`} aria-current={x.slug === c.slug ? 'page' : undefined}>{x.name}</a>)}</nav>

        <section className="wx-hero">
          <div className="wx-big"><span>{now.e}</span>{r0(d.current.temp)}°C</div>
          <div className="wx-meta">
            <b>ตอนนี้: {now.t}</b>
            <span>รู้สึกเหมือน {r0(d.current.feels)}°C · ความชื้น {d.current.humidity}% · ลม {r0(d.current.wind)} กม./ชม.</span>
            <span>ทั้งวัน: {sky(t.code).t} {r0(t.min)}°–{r0(t.max)}° · โอกาสฝนตก {t.rainProb}% · UV {r0(t.uv)}</span>
            <span style={{ color: p.c, fontWeight: 600 }}>ฝุ่น PM2.5 {d.current.pm25 != null ? r0(d.current.pm25) : '-'} µg/m³ · {p.t}</span>
          </div>
        </section>

        <section>
          <h2>พยากรณ์อากาศ{c.name} 7 วัน</h2>
          <ul className="wx-days">
            {d.days.map((x) => { const s = sky(x.code); return (
              <li key={x.date}><span className="wx-dn">{dayName(x.date)}</span><span className="wx-e">{s.e}</span><span className="wx-dt">{s.t}</span><span className="wx-rp">💧 {x.rainProb}%</span><span className="wx-mm">{r0(x.min)}° / <b>{r0(x.max)}°</b></span></li>
            ); })}
          </ul>
        </section>

        <section>
          <h2>{c.name}วันนี้ฝนตกไหม</h2>
          <p>
            วันนี้{c.name}มีโอกาสฝนตก {t.rainProb}%{t.rainMm > 0 ? ` ปริมาณฝนคาดการณ์ราว ${t.rainMm.toFixed(1)} มม.` : ''} {t.rainProb >= 60 ? 'ควรพกร่มติดตัว' : t.rainProb >= 30 ? 'อาจมีฝนบางช่วง' : 'ส่วนใหญ่ไม่มีฝน'}
            {rainDays.length ? ` · ช่วง 7 วันนี้ วันที่มีโอกาสฝนตกสูง: ${rainDays.join(', ')}` : ' · ช่วง 7 วันนี้ไม่มีวันที่โอกาสฝนตกสูง'}
          </p>
          <p>ค่าฝุ่น PM2.5 ตอนนี้ {d.current.pm25 != null ? `${r0(d.current.pm25)} ไมโครกรัมต่อลูกบาศก์เมตร อยู่ในระดับ "${p.t}"` : 'ยังไม่มีข้อมูล'} (เกณฑ์ประเทศไทย: ไม่เกิน 25 = ดี, เกิน 37.5 = เริ่มมีผลกระทบต่อสุขภาพ)</p>
        </section>
        <p className="disc">ข้อมูลพยากรณ์จาก Open-Meteo (แบบจำลองสภาพอากาศ) อัปเดตอัตโนมัติ ใช้เพื่อการอ้างอิง ประกาศเตือนภัยอย่างเป็นทางการโปรดติดตามกรมอุตุนิยมวิทยา</p>
      </div>
    </>
  );
}
