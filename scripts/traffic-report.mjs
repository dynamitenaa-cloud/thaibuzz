// 방문자 현황 리포트 → 텔레그램 (하루 1번). 사이트 방문(Cloudflare 분석) + 페북 페이지 + 사이트 참여(투표·예측) 를 한 메시지로
// 필요: TELEGRAM_*, (선택) CLOUDFLARE_API_TOKEN (분석 읽기 권한이 있어야 사이트 방문이 나옴), FB_PAGE_ID/FB_PAGE_TOKEN
// 각 항목은 따로 실패해도 나머지는 전송. 권한이 없는 항목은 "권한 없음" 이라고 표시해서 무엇을 열어야 하는지 알려줌. `--dry` 는 전송 없이 출력
import fs from 'node:fs';
import path from 'node:path';
import { telegramReady, sendTelegramText } from './lib/delivery.mjs';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://thaibuzz.net').replace(/\/$/, '');
const HOST = new URL(SITE).hostname.replace(/^www\./, '');
const DRY = process.argv.includes('--dry');
const CF = process.env.CLOUDFLARE_API_TOKEN;
const PAGE_ID = process.env.FB_PAGE_ID, FB = process.env.FB_PAGE_TOKEN;
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const sum = (a) => a.reduce((x, y) => x + y, 0);
const n = (x) => Number(x || 0).toLocaleString('en-US');
const lines = [];
const notes = [];

// ── 1) 사이트 방문 (Cloudflare GraphQL 분석) ──
async function cf(query, variables) {
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', { method: 'POST', headers: { authorization: `Bearer ${CF}`, 'content-type': 'application/json' }, body: JSON.stringify({ query, variables }) });
  const j = await r.json().catch(() => ({}));
  if (j.errors?.length) throw new Error(j.errors[0].message);
  return j.data;
}
async function site() {
  if (!CF) { notes.push('사이트 방문: CLOUDFLARE_API_TOKEN 없음'); return; }
  let zone;
  try {
    const z = await (await fetch(`https://api.cloudflare.com/client/v4/zones?name=${HOST}`, { headers: { authorization: `Bearer ${CF}` } })).json();
    zone = z.result?.[0]?.id;
    if (!zone) throw new Error(z.errors?.[0]?.message || 'zone 없음');
  } catch (e) { notes.push(`사이트 방문: 도메인 조회 실패 (${String(e.message).slice(0, 80)}) → 토큰에 "Zone 읽기" 권한 필요`); return; }
  try {
    const d = await cf(`query($z:String!,$from:Date!){viewer{zones(filter:{zoneTag:$z}){days:httpRequests1dGroups(limit:10,orderBy:[date_ASC],filter:{date_geq:$from}){dimensions{date} sum{pageViews requests} uniq{uniques}}}}}`, { z: zone, from: day(8) });
    const days = d.viewer.zones[0]?.days || [];
    if (!days.length) { notes.push('사이트 방문: 데이터 없음'); return; }
    const y = days.filter((x) => x.dimensions.date < day(0));
    const last = y[y.length - 1], prev7 = y.slice(-7);
    lines.push(`🌐 사이트 방문 (Cloudflare, 봇 포함 가능)`);
    lines.push(`• 어제(${last.dimensions.date.slice(5)}): 방문자 ${n(last.uniq.uniques)}명 · 페이지뷰 ${n(last.sum.pageViews)}`);
    lines.push(`• 최근 ${prev7.length}일 합계: 방문자 ${n(sum(prev7.map((x) => x.uniq.uniques)))}명 · 페이지뷰 ${n(sum(prev7.map((x) => x.sum.pageViews)))}`);
    lines.push(`• 일별 방문자: ${prev7.map((x) => x.uniq.uniques).join(' → ')}`);
  } catch (e) { notes.push(`사이트 방문: ${String(e.message).slice(0, 90)} → Cloudflare 토큰에 "Analytics 읽기" 권한이 필요할 수 있음`); return; }
  try { // 유입 경로 / 인기 페이지 (플랜에 따라 막힐 수 있어 따로 시도)
    const d = await cf(`query($z:String!,$from:Date!){viewer{zones(filter:{zoneTag:$z}){ref:httpRequestsAdaptiveGroups(limit:8,orderBy:[count_DESC],filter:{date_geq:$from,requestSource:"eyeball",clientRequestHTTPHost:"${HOST}",edgeResponseStatus:200}){count dimensions{clientRefererHost}}}}}`, { z: zone, from: day(2) });
    const rows = (d.viewer.zones[0]?.ref || []).filter((x) => x.dimensions.clientRefererHost !== undefined);
    if (rows.length) lines.push(`• 유입(최근 2일): ${rows.slice(0, 6).map((x) => `${x.dimensions.clientRefererHost || '직접'} ${x.count}`).join(' · ')}`);
  } catch (e) { notes.push(`유입 경로: ${String(e.message).slice(0, 70)}`); }
}

// ── 2) 페북 페이지 ──
async function facebook() {
  if (!PAGE_ID || !FB) return;
  const g = async (p, params = {}) => { const u = new URL(`https://graph.facebook.com/v25.0/${p}`); for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v); u.searchParams.set('access_token', FB); const j = await (await fetch(u)).json(); if (j.error) throw new Error(j.error.message); return j; };
  try {
    const page = await g(PAGE_ID, { fields: 'fan_count,followers_count' });
    lines.push(`\n📘 페이스북 페이지`);
    lines.push(`• 팔로워 ${n(page.followers_count)} · 좋아요 ${n(page.fan_count)}`);
  } catch (e) { notes.push(`페북 페이지: ${String(e.message).slice(0, 70)}`); return; }
  try {
    const since = Math.floor((Date.now() - 7 * 864e5) / 1000);
    const reels = (await g(`${PAGE_ID}/video_reels`, { fields: 'created_time,views,post_views', limit: 40 })).data.filter((r) => Date.parse(r.created_time) > since * 1000);
    const views = reels.map((r) => Math.max(Number(r.views) || 0, Number(r.post_views) || 0));
    lines.push(`• 릴스 최근 7일: ${reels.length}개 · 조회 합계 ${n(sum(views))} · 평균 ${n(Math.round(sum(views) / Math.max(1, reels.length)))} · 최고 ${n(Math.max(0, ...views))}`);
  } catch (e) { notes.push(`릴스 통계: ${String(e.message).slice(0, 70)}`); }
  try {
    const since = Math.floor((Date.now() - 7 * 864e5) / 1000);
    const ps = (await g(`${PAGE_ID}/posts`, { fields: 'reactions.limit(0).summary(true),comments.limit(0).summary(true),shares', limit: 50, since })).data;
    lines.push(`• 게시물 최근 7일: ${ps.length}개 · 반응 ${n(sum(ps.map((p) => p.reactions?.summary?.total_count || 0)))} · 댓글 ${n(sum(ps.map((p) => p.comments?.summary?.total_count || 0)))} · 공유 ${n(sum(ps.map((p) => p.shares?.count || 0)))}`);
  } catch (e) { notes.push(`게시물 통계: ${String(e.message).slice(0, 70)}`); }
}

// ── 3) 사이트 참여 (공개 API) ──
async function engage() {
  try {
    const slugs = fs.readdirSync(path.join('content', 'posts')).filter((f) => f.endsWith('.json') && f >= day(7).replace(/-/g, '')).map((f) => f.slice(0, -5));
    let votes = 0, reacts = 0, posts = 0, i = 0;
    await Promise.all(Array.from({ length: 8 }, async () => { while (i < slugs.length) { const s = slugs[i++]; try { const j = await (await fetch(`${SITE}/api/engage?slug=${s}`)).json(); const v = (j.votes || []).reduce((a, b) => a + b, 0), r = Object.values(j.reacts || {}).reduce((a, b) => a + b, 0); votes += v; reacts += r; if (v + r) posts++; } catch {} } }));
    const ids = []; for (const l of ['premier-league', 'laliga', 'serie-a', 'bundesliga', 'ucl']) { try { const d = JSON.parse(fs.readFileSync(path.join('content', 'live', 'football', `${l}.json`), 'utf8')); for (const m of [...d.results, ...d.fixtures]) if (/^[0-9]{5,12}$/.test(m.id)) ids.push(`m${m.id}`); } catch {} }
    let pv = 0;
    for (let k = 0; k < ids.length; k += 40) { try { const j = await (await fetch(`${SITE}/api/matches?ids=${ids.slice(k, k + 40).join(',')}`)).json(); for (const v of Object.values(j)) pv += v.votes.reduce((a, b) => a + b, 0); } catch {} }
    lines.push(`\n🗳 사이트 참여 (최근 7일 글 ${slugs.length}개)`);
    lines.push(`• 글 투표 ${n(votes)} · 반응 ${n(reacts)} (참여가 있는 글 ${posts}개) · 경기 예측 ${n(pv)}표`);
  } catch (e) { notes.push(`참여 집계: ${String(e.message).slice(0, 70)}`); }
}

await site(); await facebook(); await engage();
const text = [`📊 ThaiBuzz 방문자 현황 (${day(0)})`, '', ...lines, ...(notes.length ? ['', '⚠️ 못 읽은 항목', ...notes.map((x) => `• ${x}`)] : [])].join('\n');
console.log(text);
if (!DRY && telegramReady()) { await sendTelegramText(text); console.log('traffic-report: 전송됨'); }
