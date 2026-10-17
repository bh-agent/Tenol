import { createClient } from '@/lib/supabase/server';
import { kstToday } from '@/lib/utils/next-match-date';
import { getClubMemberIds } from './member-ids';

export type MvpPeriod = 'match' | 'week' | 'month' | 'year' | 'all';

export type MvpEntry = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  ntrp_level: number | null;
  total_score: number;
  games_played: number;
  wins: number;
  win_rate: number;
};

type MvpAgg = { totalScore: number; gamesPlayed: number; wins: number };

/** MVP 순위 규칙 (results/page.tsx와 동일): 승수 → 총득점 → 평균득점 */
export function compareMvp(a: MvpAgg, b: MvpAgg): number {
  if (b.wins !== a.wins) return b.wins - a.wins;
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  const avgA = a.gamesPlayed > 0 ? a.totalScore / a.gamesPlayed : 0;
  const avgB = b.gamesPlayed > 0 ? b.totalScore / b.gamesPlayed : 0;
  return avgB - avgA;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 기간 시작일 (KST 달력 기준).
 * - week: 이번 주 월요일
 * - month: 이번 달 1일
 * - year: 올해 1월 1일
 * (이전엔 최근 7일/30일/365일 롤링이라 "이번 주 MVP"가 지난주 경기까지 포함했다)
 */
export function getPeriodStartDate(period: MvpPeriod, today: Date = kstToday()): string | null {
  if (period === 'all' || period === 'match') return null;
  const d = new Date(today);
  switch (period) {
    case 'week': {
      const diffToMonday = (d.getDay() + 6) % 7; // 일(0)→6, 월(1)→0
      d.setDate(d.getDate() - diffToMonday);
      break;
    }
    case 'month':
      d.setDate(1);
      break;
    case 'year':
      d.setMonth(0, 1);
      break;
  }
  return toDateStr(d);
}

async function buildMvpRanking(
  clubId: string,
  period: MvpPeriod,
  limit: number
): Promise<MvpEntry[]> {
  const supabase = await createClient();
  const startDate = getPeriodStartDate(period);

  let query = supabase
    .from('player_game_stats')
    .select('user_id, result, score_team_a, score_team_b, team, match_date')
    .eq('club_id', clubId)
    .not('score_team_a', 'is', null);

  if (startDate) {
    query = query.gte('match_date', startDate);
  }

  const [{ data: rows }, memberIds] = await Promise.all([query, getClubMemberIds(clubId)]);

  // 클럽 회원만 (게스트 참가 계정 제외)
  const data = (rows ?? []).filter((r) => memberIds.has(r.user_id));

  if (data.length === 0) return [];

  // Aggregate: for each player, sum the score of their team, count games & wins
  const playerAgg: Record<
    string,
    { totalScore: number; gamesPlayed: number; wins: number }
  > = {};

  for (const row of data) {
    if (!playerAgg[row.user_id]) {
      playerAgg[row.user_id] = { totalScore: 0, gamesPlayed: 0, wins: 0 };
    }
    const agg = playerAgg[row.user_id];
    agg.gamesPlayed++;

    // Add the score of the player's own team
    const myScore =
      row.team === 'team_a' ? row.score_team_a : row.score_team_b;
    agg.totalScore += myScore ?? 0;

    if (row.result === 'win') {
      agg.wins++;
    }
  }

  // Min threshold: 3 games for MVP consideration
  const qualified = Object.entries(playerAgg).filter(
    ([, v]) => v.gamesPlayed >= 3
  );

  if (qualified.length === 0) {
    // Fall back to no threshold if nobody qualifies
    const all = Object.entries(playerAgg);
    if (all.length === 0) return [];
    // Use all with at least 1 game
    qualified.push(
      ...all.filter(([, v]) => v.gamesPlayed >= 1)
    );
    if (qualified.length === 0) return [];
  }

  // 경기 결과 화면(results/page.tsx)의 '오늘의 MVP'와 동일한 규칙으로 통일:
  // 승수 → 총득점 → 평균득점. (이전엔 평균득점 우선이라 같은 클럽에서 결과 화면과
  // 통계 화면의 MVP가 서로 다르게 나왔다)
  qualified.sort((a, b) => compareMvp(a[1], b[1]));

  const topEntries = qualified.slice(0, limit);
  const userIds = topEntries.map(([uid]) => uid);

  // Fetch profiles
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, ntrp_level')
    .in('id', userIds);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

  return topEntries.map(([uid, agg]) => {
    const profile = profileMap.get(uid);
    return {
      user_id: uid,
      display_name: profile?.display_name || '알 수 없음',
      avatar_url: profile?.avatar_url || null,
      ntrp_level: profile?.ntrp_level ?? null,
      total_score: agg.totalScore,
      games_played: agg.gamesPlayed,
      wins: agg.wins,
      win_rate:
        agg.gamesPlayed > 0
          ? Math.round((agg.wins / agg.gamesPlayed) * 100)
          : 0,
    };
  });
}

/** Returns top 3 players for the period (with co-MVP support for ties) */
export async function getClubMvp(
  clubId: string,
  period: MvpPeriod
): Promise<MvpEntry[]> {
  return buildMvpRanking(clubId, period, 3);
}

/** Returns top N players ranked by score */
export async function getClubMvpRanking(
  clubId: string,
  period: MvpPeriod,
  limit = 10
): Promise<MvpEntry[]> {
  return buildMvpRanking(clubId, period, limit);
}

/** MVP for a specific match (highest avg scorer) */
export async function getMatchMvp(
  matchId: string
): Promise<MvpEntry | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('player_game_stats')
    .select('user_id, result, score_team_a, score_team_b, team')
    .eq('match_id', matchId)
    .not('score_team_a', 'is', null);

  if (!data || data.length === 0) return null;

  const playerAgg: Record<
    string,
    { totalScore: number; gamesPlayed: number; wins: number }
  > = {};

  for (const row of data) {
    if (!playerAgg[row.user_id]) {
      playerAgg[row.user_id] = { totalScore: 0, gamesPlayed: 0, wins: 0 };
    }
    const agg = playerAgg[row.user_id];
    agg.gamesPlayed++;

    const myScore =
      row.team === 'team_a' ? row.score_team_a : row.score_team_b;
    agg.totalScore += myScore ?? 0;

    if (row.result === 'win') {
      agg.wins++;
    }
  }

  const entries = Object.entries(playerAgg);
  if (entries.length === 0) return null;

  entries.sort((a, b) => compareMvp(a[1], b[1]));

  const [mvpId, agg] = entries[0];

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, ntrp_level')
    .eq('id', mvpId)
    .maybeSingle();

  return {
    user_id: mvpId,
    display_name: profile?.display_name || '알 수 없음',
    avatar_url: profile?.avatar_url || null,
    ntrp_level: profile?.ntrp_level ?? null,
    total_score: agg.totalScore,
    games_played: agg.gamesPlayed,
    wins: agg.wins,
    win_rate:
      agg.gamesPlayed > 0
        ? Math.round((agg.wins / agg.gamesPlayed) * 100)
        : 0,
  };
}
