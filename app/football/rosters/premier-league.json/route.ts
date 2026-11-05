import { rosterResponse } from '@/lib/rosters-route';

export const dynamic = 'force-static';
export const GET = () => rosterResponse('premier-league');
