import { createClient } from '@/lib/supabase/server';

export type ProfileStats = {
  totalGames: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgScore: number;
  recentGames: {
    result: 'win' | 'loss' | 'draw';
    myScore: number;
    opponentScore: number;
    matchDate: string;
  }[];
};

export async function getProfileStats(userId: string): Promise<ProfileStats> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('player_game_stats')
    .select('result, score_team_a, score_team_b, team, match_date')
    .eq('user_id', userId)
    .not('score_team_a', 'is', null)
    .order('match_date', { ascending: false });

  if (!data || data.length === 0) {
    return {
      totalGames: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      winRate: 0,
      avgScore: 0,
      recentGames: [],
    };
  }

  let wins = 0;
  let losses = 0;
  let draws = 0;
  let totalScore = 0;

  for (const row of data) {
    if (row.result === 'win') wins++;
    else if (row.result === 'loss') losses++;
    else draws++;

    const myScore =
      row.team === 'team_a' ? row.score_team_a : row.score_team_b;
    totalScore += myScore ?? 0;
  }

  const totalGames = data.length;
  const avgScore =
    totalGames > 0 ? Math.round((totalScore / totalGames) * 10) / 10 : 0;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  const recentGames = data.slice(0, 5).map((row) => {
    const myScore =
      row.team === 'team_a' ? (row.score_team_a ?? 0) : (row.score_team_b ?? 0);
    const opponentScore =
      row.team === 'team_a' ? (row.score_team_b ?? 0) : (row.score_team_a ?? 0);

    let result: 'win' | 'loss' | 'draw';
    if (row.result === 'win') result = 'win';
    else if (row.result === 'loss') result = 'loss';
    else result = 'draw';

    return {
      result,
      myScore,
      opponentScore,
      matchDate: row.match_date,
    };
  });

  return {
    totalGames,
    wins,
    losses,
    draws,
    winRate,
    avgScore,
    recentGames,
  };
}
