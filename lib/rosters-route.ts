import { getRosters } from './football-xi';

// /football/rosters/<league>.json — BEST 11 만들기 페이지가 브라우저에서 불러가는 정적 파일 (선수 명단)
export function rosterResponse(league: string) {
  const teams = getRosters()?.leagues[league] ?? [];
  return Response.json({ teams }, { headers: { 'cache-control': 'public, max-age=3600' } });
}
