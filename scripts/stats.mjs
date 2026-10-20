// 페이스북 페이지 / 인스타그램 통계 요약 (Graph API, 무료). Actions 의 stats 워크플로에서 실행 → 로그로 확인
// 필요: FB_PAGE_ID, FB_PAGE_TOKEN
const PAGE_ID = process.env.FB_PAGE_ID;
const TOKEN = process.env.FB_PAGE_TOKEN;
const API = 'https://graph.facebook.com/v25.0';
const DAYS = Number(process.env.STATS_DAYS || 14);
if (!PAGE_ID || !TOKEN) { console.log('stats: FB_PAGE_ID/FB_PAGE_TOKEN 없음'); process.exit(0); }

const get = async (p, params = {}) => {
  const u = new URL(`${API}/${p}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  u.searchParams.set('access_token', TOKEN);
  const j = await (await fetch(u)).json();
  if (j.error) throw new Error(`${p}: ${j.error.message}`);
  return j;
};
const since = Math.floor((Date.now() - DAYS * 864e5) / 1000);
const sum = (arr) => arr.reduce((a, b) => a + b, 0);
const short = (s, n = 60) => String(s || '').replace(/\s+/g, ' ').slice(0, n);

console.log(`=== Facebook 페이지 (최근 ${DAYS}일) ===`);
try {
  const page = await get(PAGE_ID, { fields: 'name,fan_count,followers_count' });
  console.log(`페이지: ${page.name} | 좋아요 ${page.fan_count} | 팔로워 ${page.followers_count}`);
} catch (e) { console.log('page:', e.message); }
try {
  for (const metric of ['page_post_engagements', 'page_impressions', 'page_impressions_unique', 'page_views_total', 'page_daily_follows', 'page_fan_adds', 'page_video_views']) {
    try {
      const ins = await get(`${PAGE_ID}/insights`, { metric, period: 'day', since, until: Math.floor(Date.now() / 1000) });
      for (const m of ins.data) { const vals = m.values.map((v) => Number(v.value) || 0); console.log(`${m.name}: 합계 ${sum(vals)} | 일별 ${vals.join(',')}`); }
    } catch (e) { console.log(`${metric}: 사용 불가`); }
  }
} catch (e) { console.log('insights:', e.message); }

console.log(`\n=== 최근 게시물 (반응 기준 상위) ===`);
try {
  const posts = await get(`${PAGE_ID}/posts`, { fields: 'message,created_time,permalink_url,reactions.summary(true).limit(0),shares,comments.summary(true).limit(0)', limit: 50, since });
  const rows = posts.data.map((p) => {
    return { when: p.created_time.slice(5, 16), reach: 0, clicks: 0, reactions: p.reactions?.summary?.total_count || 0, comments: p.comments?.summary?.total_count || 0, shares: p.shares?.count || 0, text: short(p.message) };
  });
  const tot = { reach: sum(rows.map((r) => r.reach)), reactions: sum(rows.map((r) => r.reactions)), clicks: sum(rows.map((r) => r.clicks)), comments: sum(rows.map((r) => r.comments)), shares: sum(rows.map((r) => r.shares)) };
  console.log(`게시물 ${rows.length}개 | 도달 합계 ${tot.reach} | 반응 ${tot.reactions} | 클릭 ${tot.clicks} | 댓글 ${tot.comments} | 공유 ${tot.shares}`);
  rows.sort((a, b) => (b.reactions + b.comments * 2 + b.shares * 3) - (a.reactions + a.comments * 2 + a.shares * 3)).slice(0, 12).forEach((r) => console.log(`  ${r.when} 도달 ${r.reach} 클릭 ${r.clicks} 반응 ${r.reactions} 댓글 ${r.comments} 공유 ${r.shares} | ${r.text}`));
} catch (e) { console.log('posts:', e.message); }

console.log(`\n=== Facebook Reels ===`);
try {
  const reels = await get(`${PAGE_ID}/video_reels`, { fields: 'created_time,description,views,post_views,post_id', limit: 30 });
  const rows = reels.data.map((r) => ({ when: (r.created_time || '').slice(5, 16), views: r.views ?? r.post_views ?? 0, text: short(r.description) }));
  console.log(`릴스 ${rows.length}개 | 조회 합계 ${sum(rows.map((r) => Number(r.views) || 0))}`);
  rows.sort((a, b) => b.views - a.views).slice(0, 10).forEach((r) => console.log(`  ${r.when} 조회 ${r.views} | ${r.text}`));
} catch (e) { console.log('reels:', e.message); }

console.log(`\n=== Instagram ===`);
try {
  const { instagram_business_account: ig } = await get(PAGE_ID, { fields: 'instagram_business_account' });
  if (!ig) console.log('인스타 미연결');
  else {
    const acc = await get(ig.id, { fields: 'username,followers_count,media_count' });
    console.log(`@${acc.username} | 팔로워 ${acc.followers_count} | 게시물 ${acc.media_count}`);
    try {
      const ins = await get(`${ig.id}/insights`, { metric: 'reach,views', period: 'day', since, until: Math.floor(Date.now() / 1000) });
      for (const m of ins.data) console.log(`${m.name}: 합계 ${sum(m.values.map((v) => Number(v.value) || 0))}`);
    } catch (e) { console.log('ig insights:', e.message); }
    const media = await get(`${ig.id}/media`, { fields: 'timestamp,caption,like_count,comments_count,media_product_type,insights.metric(reach,views,saved,shares)', limit: 30 });
    const rows = media.data.map((m) => {
      const x = Object.fromEntries((m.insights?.data || []).map((i) => [i.name, i.values?.[0]?.value]));
      return { when: m.timestamp.slice(5, 16), type: m.media_product_type, reach: x.reach || 0, views: x.views || 0, likes: m.like_count, comments: m.comments_count, saved: x.saved || 0, shares: x.shares || 0, text: short(m.caption) };
    });
    console.log(`게시물 ${rows.length}개 | 도달 합계 ${sum(rows.map((r) => r.reach))} | 조회 ${sum(rows.map((r) => r.views))} | 좋아요 ${sum(rows.map((r) => r.likes))}`);
    rows.sort((a, b) => b.reach - a.reach).slice(0, 10).forEach((r) => console.log(`  ${r.when} ${r.type} 도달 ${r.reach} 조회 ${r.views} 좋아요 ${r.likes} 댓글 ${r.comments} 저장 ${r.saved} 공유 ${r.shares} | ${r.text}`));
  }
} catch (e) { console.log('ig:', e.message); }
