import { cache } from 'react';
import { getLeagueData, LEAGUES, thTeam, type Match, type Row } from './football';
import { getRosters, type Team } from './football-xi';

// 경기 프리뷰(/football/match/<id>/)·팀(/football/team/<slug>/) 페이지용 데이터. 전부 content/live/football 의 ESPN 공개 데이터에서 나옴
export type MatchEx = Match & { league: string; leagueName: string; leagueEn: string };

const NOW = () => Date.now();
// 사이트에 페이지를 만들 경기: 앞으로 10일 안 + 최근 7일 안에 끝난 경기 (데이터에서 빠지면 페이지도 사라짐)
export const allMatches = cache((): MatchEx[] => {
  const seen = new Map<string, MatchEx>();
  for (const l of LEAGUES) {
    const d = getLeagueData(l.slug);
    if (!d) continue;
    for (const m of [...d.results, ...d.fixtures]) {
      if (!/^[0-9]{5,12}$/.test(m.id)) continue;
      const t = Date.parse(m.date);
      if (!(t < NOW() + 10 * 864e5 && t > NOW() - 7 * 864e5)) continue;
      seen.set(m.id, { ...m, league: l.slug, leagueName: l.name, leagueEn: l.en });
    }
  }
  return [...seen.values()].sort((a, b) => a.date.localeCompare(b.date));
});
export const getMatch = (id: string) => allMatches().find((m) => m.id === id);

export const tableRow = (league: string, team: string): Row | undefined => getLeagueData(league)?.table.find((r) => r.team === team);

// 영문 팀명 → URL slug (Málaga → malaga, Brighton & Hove Albion → brighton-hove-albion)
export const teamSlug = (name: string) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export type TeamEx = Team & { league: string; leagueName: string; slug: string };
export const allTeams = cache((): TeamEx[] => {
  const r = getRosters();
  if (!r) return [];
  return LEAGUES.flatMap((l) => (r.leagues[l.slug] || []).map((t) => ({ ...t, league: l.slug, leagueName: l.name, slug: teamSlug(t.name) })));
});
export const teamByName = (name: string) => allTeams().find((t) => t.name === name);

// 팀의 최근 결과 (리그 데이터에 있는 것만, 최신순)
export function formOf(team: string, limit = 5): { m: MatchEx; r: 'W' | 'D' | 'L'; gf: number; ga: number }[] {
  const out: { m: MatchEx; r: 'W' | 'D' | 'L'; gf: number; ga: number }[] = [];
  const seen = new Set<string>();
  for (const l of LEAGUES) {
    for (const m of getLeagueData(l.slug)?.results || []) {
      if (m.status !== 'post' || seen.has(m.id) || (m.home !== team && m.away !== team)) continue;
      seen.add(m.id);
      const home = m.home === team;
      const gf = Number(home ? m.hs : m.as), ga = Number(home ? m.as : m.hs);
      out.push({ m: { ...m, league: l.slug, leagueName: l.name, leagueEn: l.en }, r: gf > ga ? 'W' : gf < ga ? 'L' : 'D', gf, ga });
    }
  }
  return out.sort((a, b) => b.m.date.localeCompare(a.m.date)).slice(0, limit);
}

// 경기 전 소개문 (사실만: 순위·전적·득실. 승부 예측/도박성 표현 없음)
export function previewText(m: MatchEx): string {
  const h = tableRow(m.league, m.home), a = tableRow(m.league, m.away);
  const H = thTeam(m.home), A = thTeam(m.away);
  const one = (n: string, r: Row) => `${n} อยู่อันดับ ${r.rank} ของตาราง มี ${r.pts} คะแนน จาก ${r.p} นัด (ชนะ ${r.w} เสมอ ${r.d} แพ้ ${r.l}) ยิงได้ ${r.gf} ประตู เสีย ${r.ga} ประตู`;
  if (h && a) {
    const gap = Math.abs(h.pts - a.pts);
    const tail = gap === 0 ? `ทั้งสองทีมมีคะแนนเท่ากัน` : `${h.pts > a.pts ? H : A} นำอยู่ ${gap} คะแนน`;
    return `ก่อนเตะ ${one(H, h)} ส่วน ${one(A, a)} ${tail}`;
  }
  return `${H} พบ ${A} ในศึก${m.leagueName} ${m.venue ? `ที่ ${m.venue}` : ''}`.trim();
}
