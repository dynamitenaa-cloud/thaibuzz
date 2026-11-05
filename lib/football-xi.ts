import fs from 'node:fs';
import path from 'node:path';
import { cache } from 'react';

// 축구 참여 기능 데이터 (scripts/football-players.mjs 가 ESPN 에서 수집 → content/live/football/)
export type Pos = 'GK' | 'DF' | 'MF' | 'FW';
export type Player = { id: string; n: string; p: Pos; no: string };
export type Team = { id: string; name: string; players: Player[] };
export const PLAYER_LEAGUES = [
  { slug: 'premier-league', name: 'พรีเมียร์ลีก' },
  { slug: 'laliga', name: 'ลาลีกา' },
  { slug: 'serie-a', name: 'เซเรีย อา' },
  { slug: 'bundesliga', name: 'บุนเดสลีกา' },
] as const;

const read = <T,>(f: string): T | null => { try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'content', 'live', 'football', f), 'utf8')) as T; } catch { return null; } };

export const getRosters = cache(() => read<{ updatedAt: string; leagues: Record<string, Team[]> }>('rosters.json'));

export type Cand = { id: string; name: string; team: string; note: string };
export type XiLeague = { matches: number; positions: Record<Pos, Cand[]> };
export type Xi = { updatedAt: string; round: string; label: string; leagues: Record<string, XiLeague> };
export const getXi = cache(() => read<Xi>('xi.json'));
