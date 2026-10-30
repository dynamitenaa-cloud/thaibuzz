import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';

// 축구 허브 (/football/, /football/<league>/). 데이터는 scripts/live-data.mjs 가 ESPN 공개 데이터에서 매시간 수집
export const LEAGUES = [
  { slug: 'premier-league', espn: 'eng.1', name: 'พรีเมียร์ลีก', en: 'Premier League', tags: /พรีเมียร์ลีก|premier league|ศึกผู้ดี/i },
  { slug: 'laliga', espn: 'esp.1', name: 'ลาลีกา', en: 'LaLiga', tags: /ลาลีกา|laliga|la liga/i },
  { slug: 'serie-a', espn: 'ita.1', name: 'กัลโช่ เซเรีย อา', en: 'Serie A', tags: /เซเรีย ?อา|กัลโช่|serie a/i },
  { slug: 'bundesliga', espn: 'ger.1', name: 'บุนเดสลีกา', en: 'Bundesliga', tags: /บุนเดสลีกา|bundesliga/i },
  { slug: 'ucl', espn: 'uefa.champions', name: 'ยูฟ่า แชมเปียนส์ลีก', en: 'UEFA Champions League', tags: /แชมเปียนส์ลีก|ucl|champions league/i },
] as const;
export type League = (typeof LEAGUES)[number];

export type Row = { rank: number; team: string; p: number; w: number; d: number; l: number; gf: number; ga: number; gd: number; pts: number };
export type Match = { id: string; date: string; status: 'pre' | 'in' | 'post'; detail: string; home: string; away: string; hs: string; as: string; venue: string };
export type LeagueData = { slug: string; season: string; updatedAt: string; table: Row[]; results: Match[]; fixtures: Match[] };

export const getLeagueData = cache((slug: string): LeagueData | null => {
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'live', 'football', `${slug}.json`), 'utf8')); } catch { return null; }
});
export const leagueBySlug = (slug: string) => LEAGUES.find((l) => l.slug === slug);
// 글 → 관련 리그 (기사 하단 "ตารางคะแนน" 링크용)
export const leagueForPost = (text: string) => LEAGUES.find((l) => l.tags.test(text));

// 태국 매체 표기 (못 찾으면 영문 그대로)
const TH: [RegExp, string][] = [
  [/^arsenal/i, 'อาร์เซนอล'], [/^aston villa/i, 'แอสตัน วิลล่า'], [/bournemouth/i, 'บอร์นมัธ'], [/^brentford/i, 'เบรนท์ฟอร์ด'], [/^brighton/i, 'ไบรท์ตัน'],
  [/^chelsea/i, 'เชลซี'], [/^crystal palace/i, 'คริสตัล พาเลซ'], [/^everton/i, 'เอฟเวอร์ตัน'], [/^fulham/i, 'ฟูแล่ม'], [/^liverpool/i, 'ลิเวอร์พูล'],
  [/^manchester city/i, 'แมนเชสเตอร์ ซิตี้'], [/^manchester united/i, 'แมนเชสเตอร์ ยูไนเต็ด'], [/^newcastle/i, 'นิวคาสเซิล'], [/^nottingham/i, 'น็อตติ้งแฮม ฟอเรสต์'],
  [/^tottenham/i, 'ท็อตแนม ฮอทสเปอร์'], [/^west ham/i, 'เวสต์แฮม'], [/^wolverhampton|^wolves/i, 'วูล์ฟแฮมป์ตัน'], [/^leeds/i, 'ลีดส์ ยูไนเต็ด'], [/^burnley/i, 'เบิร์นลีย์'],
  [/^sunderland/i, 'ซันเดอร์แลนด์'], [/^ipswich/i, 'อิปสวิช ทาวน์'], [/^leicester/i, 'เลสเตอร์ ซิตี้'], [/^southampton/i, 'เซาแธมป์ตัน'], [/^hull/i, 'ฮัลล์ ซิตี้'],
  [/^coventry/i, 'โคเวนทรี'], [/^sheffield united/i, 'เชฟฟิลด์ ยูไนเต็ด'], [/^middlesbrough/i, 'มิดเดิลสโบรช์'], [/^norwich/i, 'นอริช ซิตี้'], [/^west brom/i, 'เวสต์บรอม'],
  [/^real madrid/i, 'เรอัล มาดริด'], [/^barcelona/i, 'บาร์เซโลนา'], [/^atl[eé]tico/i, 'แอตเลติโก มาดริด'], [/^athletic/i, 'แอธเลติก บิลเบา'], [/^real sociedad/i, 'เรอัล โซเซียดาด'],
  [/^villarreal/i, 'บียาร์เรอัล'], [/^real betis|^betis/i, 'เรอัล เบติส'], [/^sevilla/i, 'เซบีย่า'], [/^valencia/i, 'บาเลนเซีย'], [/^girona/i, 'กิโรนา'], [/^celta/i, 'เซลต้า บีโก้'],
  [/^osasuna/i, 'โอซาซูน่า'], [/^getafe/i, 'เคตาเฟ่'], [/^mallorca/i, 'มายอร์ก้า'], [/^rayo/i, 'ราโย บาเยกาโน่'], [/^espanyol/i, 'เอสปันญ่อล'], [/^alav[eé]s/i, 'อลาเบส'],
  [/^internazionale|^inter\b/i, 'อินเตอร์ มิลาน'], [/^ac milan|^milan/i, 'เอซี มิลาน'], [/^juventus/i, 'ยูเวนตุส'], [/^napoli/i, 'นาโปลี'], [/^as roma|^roma/i, 'โรมา'],
  [/^lazio/i, 'ลาซิโอ'], [/^atalanta/i, 'อตาลันต้า'], [/^fiorentina/i, 'ฟิออเรนติน่า'], [/^torino/i, 'โตรีโน'], [/^bologna/i, 'โบโลญญา'], [/^como/i, 'โคโม่'],
  [/^udinese/i, 'อูดิเนเซ่'], [/^genoa/i, 'เจนัว'], [/^monza/i, 'มอนซา'], [/^cagliari/i, 'กายารี'], [/^parma/i, 'ปาร์ม่า'], [/^sassuolo/i, 'ซาสซูโอโล่'],
  [/^bayern/i, 'บาเยิร์น มิวนิค'], [/^borussia dortmund|^dortmund/i, 'โบรุสเซีย ดอร์ทมุนด์'], [/leverkusen/i, 'ไบเออร์ เลเวอร์คูเซ่น'], [/leipzig/i, 'แอร์เบ ไลป์ซิก'],
  [/frankfurt/i, 'ไอน์ทรัค แฟรงก์เฟิร์ต'], [/stuttgart/i, 'สตุ๊ตการ์ท'], [/freiburg/i, 'ไฟรบวร์ก'], [/wolfsburg/i, 'โวล์ฟสบวร์ก'], [/m[oö]nchengladbach/i, 'กลัดบัค'],
  [/union berlin/i, 'อูนิโอน เบอร์ลิน'], [/hoffenheim/i, 'ฮอฟเฟ่นไฮม์'], [/mainz/i, 'ไมนซ์'], [/werder|bremen/i, 'แวร์เดอร์ เบรเมน'], [/augsburg/i, 'เอาก์สบวร์ก'],
  [/elversberg/i, 'เอลเฟอร์สเบิร์ก'], [/^hamburg/i, 'ฮัมบูร์ก'], [/cologne|k[oö]ln/i, 'โคโลญจน์'], [/paderborn/i, 'พาเดอร์บอร์น'], [/schalke/i, 'ชาลเก้'],
  [/^deportivo/i, 'เดปอร์ติโบ'], [/racing santander/i, 'ราซิ่ง ซานตานเดร์'], [/^levante/i, 'เลบันเต้'], [/^elche/i, 'เอลเช่'], [/^m[aá]laga/i, 'มาลาก้า'],
  [/frosinone/i, 'โฟรซิโนเน่'], [/^lecce/i, 'เลชเช่'], [/^venezia/i, 'เวเนเซีย'], [/shakhtar/i, 'ชัคตาร์ โดเนตส์ก'], [/feyenoord/i, 'เฟเยนูร์ด'], [/^lens/i, 'ล็องส์'],
  [/bod[oø]/i, 'โบโด กลิมท์'], [/aek athens/i, 'เออีเค เอเธนส์'], [/fenerbah/i, 'เฟเนร์บาห์เช่'], [/slavia/i, 'สลาเวีย ปราก'], [/slovan/i, 'สโลวาน บราติสลาวา'],
  [/^paris saint|^psg/i, 'ปารีส แซงต์ แชร์กแมง'], [/^benfica/i, 'เบนฟิก้า'], [/porto/i, 'ปอร์โต้'], [/^sporting/i, 'สปอร์ติ้ง ลิสบอน'], [/^ajax/i, 'อาแจ็กซ์'],
  [/^psv/i, 'พีเอสวี'], [/^celtic/i, 'เซลติก'], [/^monaco/i, 'โมนาโก'], [/^marseille/i, 'มาร์กเซย'], [/^lille/i, 'ลีลล์'], [/^galatasaray/i, 'กาลาตาซาราย'], [/^club brugge/i, 'คลับ บรูช'],
];
export const thTeam = (en: string) => TH.find(([re]) => re.test(en.trim()))?.[1] ?? en;

export const thTime = (iso: string) => new Date(iso).toLocaleString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });
export const thDay = (iso: string) => new Date(iso).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', weekday: 'short', day: 'numeric', month: 'short' });
export const thDayKey = (iso: string) => new Date(iso).toLocaleDateString('sv-SE', { timeZone: 'Asia/Bangkok' });
export const todayTh = () => new Date().toLocaleDateString('th-TH-u-ca-buddhist', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short', year: '2-digit' });
