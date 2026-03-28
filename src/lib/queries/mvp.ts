import { createClient } from '@/lib/supabase/server';

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

function getPeriodStartDate(period: MvpPeriod): string | null {
  if (period === 'all' || period === 'match') return null;
  const now = new Date();
  switch (period) {
    case 'week':
      now.setDate(now.getDate() - 7);
      break;
    case 'month':
      now.setDate(now.getDate() - 30);
      break;
    case 'year':
      now.setDate(now.getDate() - 365);
      break;
  }
  return now.toISOString().split('T')[0];
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
    .not('result', 'is', null);

  if (startDate) {
    query = query.gte('match_date', startDate);
  }

  const { data } = await query;

  if (!data || data.length === 0) return [];

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

  // Sort by total score desc, tiebreaker: more games played
  qualified.sort((a, b) => {
    if (b[1].totalScore !== a[1].totalScore)
      return b[1].totalScore - a[1].totalScore;
    return b[1].gamesPlayed - a[1].gamesPlayed;
  });

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

/** Returns the single top player for the period */
export async function getClubMvp(
  clubId: string,
  period: MvpPeriod
): Promise<MvpEntry | null> {
  const ranking = await buildMvpRanking(clubId, period, 1);
  return ranking[0] || null;
}

/** Returns top N players ranked by score */
export async function getClubMvpRanking(
  clubId: string,
  period: MvpPeriod,
  limit = 10
): Promise<MvpEntry[]> {
  return buildMvpRanking(clubId, period, limit);
}

/** MVP for a specific match (highest scorer) */
export async function getMatchMvp(
  matchId: string
): Promise<MvpEntry | null> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('player_game_stats')
    .select('user_id, result, score_team_a, score_team_b, team')
    .eq('match_id', matchId)
    .not('result', 'is', null);

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

  entries.sort((a, b) => {
    if (b[1].totalScore !== a[1].totalScore)
      return b[1].totalScore - a[1].totalScore;
    return b[1].gamesPlayed - a[1].gamesPlayed;
  });

  const [mvpId, agg] = entries[0];

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, ntrp_level')
    .eq('id', mvpId)
    .single();

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
