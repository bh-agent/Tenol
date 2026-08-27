import { createClient } from '@/lib/supabase/server';

export async function getPlayerStats(userId: string, clubId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('player_game_stats')
    .select('*')
    .eq('user_id', userId);

  if (clubId) {
    query = query.eq('club_id', clubId);
  }

  const { data } = await query;

  if (!data) return { wins: 0, losses: 0, draws: 0, total: 0, winRate: 0 };

  // 점수가 입력된 모든 경기 포함 (무승부 포함)
  const scored = data.filter((g) => g.score_team_a !== null);
  const wins = scored.filter((g) => g.result === 'win').length;
  const losses = scored.filter((g) => g.result === 'loss').length;
  const draws = scored.filter((g) => g.result === null).length;
  const total = scored.length;

  return {
    wins,
    losses,
    draws,
    total,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
  };
}

export async function getPlayerRecentGames(userId: string, limit: number = 10, clubId?: string) {
  const supabase = await createClient();

  // 점수가 입력된 경기만(무승부 포함). result=null은 무승부와 미입력 둘 다이므로
  // score 기준으로 걸러 무승부가 요약과 어긋나지 않게 한다.
  let query = supabase
    .from('player_game_stats')
    .select('*')
    .eq('user_id', userId)
    .not('score_team_a', 'is', null);

  if (clubId) {
    query = query.eq('club_id', clubId);
  }

  const { data } = await query
    .order('match_date', { ascending: false })
    .limit(limit);

  if (!data || data.length === 0) return [];

  // Fetch match titles for each game
  const matchIds = [...new Set(data.map((g) => g.match_id))];
  const { data: matches } = await supabase
    .from('matches')
    .select('id, title, location, club_id, clubs(name)')
    .in('id', matchIds);

  const matchMap = new Map(matches?.map((m) => [m.id, m]) || []);

  return data.map((game) => {
    const match = matchMap.get(game.match_id);
    return {
      gameId: game.game_id,
      matchId: game.match_id,
      matchTitle: match?.title || '경기',
      clubName: (match?.clubs as any)?.name || '',
      location: match?.location || '',
      matchDate: game.match_date,
      result: (game.result ?? 'draw') as 'win' | 'loss' | 'draw',
      scoreTeamA: game.score_team_a,
      scoreTeamB: game.score_team_b,
      team: game.team as 'team_a' | 'team_b',
    };
  });
}

export async function getClubLeaderboard(clubId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('player_game_stats')
    .select('user_id, result, score_team_a')
    .eq('club_id', clubId)
    .not('score_team_a', 'is', null);

  if (!data || data.length === 0) return [];

  // Aggregate stats per player (점수 입력된 모든 경기 포함)
  const playerStats: Record<string, { wins: number; losses: number; draws: number; total: number }> = {};

  for (const row of data) {
    if (!playerStats[row.user_id]) {
      playerStats[row.user_id] = { wins: 0, losses: 0, draws: 0, total: 0 };
    }
    const stats = playerStats[row.user_id];
    if (row.result === 'win') {
      stats.wins++;
    } else if (row.result === 'loss') {
      stats.losses++;
    } else {
      stats.draws++;
    }
    stats.total++;
  }

  // Get profiles for all players
  const userIds = Object.keys(playerStats);
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, ntrp_level')
    .in('id', userIds);

  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

  // Build leaderboard sorted by win rate, then by total games
  const sorted = userIds
    .map((userId) => {
      const stats = playerStats[userId];
      const profile = profileMap.get(userId);
      return {
        userId,
        displayName: profile?.display_name || '알 수 없음',
        avatarUrl: profile?.avatar_url || null,
        ntrpLevel: profile?.ntrp_level || null,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        total: stats.total,
        winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
        rank: 0,
      };
    })
    .sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.total - a.total;
    });

  // 동점 순위 부여
  sorted.forEach((entry, i) => {
    if (i === 0) {
      entry.rank = 1;
    } else {
      const prev = sorted[i - 1];
      entry.rank = (entry.winRate === prev.winRate && entry.total === prev.total)
        ? prev.rank
        : i + 1;
    }
  });

  return sorted;
}

export async function getMatchMVP(matchId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('player_game_stats')
    .select('user_id, result')
    .eq('match_id', matchId);

  if (!data || data.length === 0) return null;

  // Count wins per player
  const winCounts: Record<string, number> = {};
  for (const stat of data) {
    if (stat.result === 'win') {
      winCounts[stat.user_id] = (winCounts[stat.user_id] || 0) + 1;
    }
  }

  // Find the player with the most wins
  let mvpId: string | null = null;
  let maxWins = 0;
  for (const [userId, wins] of Object.entries(winCounts)) {
    if (wins > maxWins) {
      maxWins = wins;
      mvpId = userId;
    }
  }

  if (!mvpId) return null;

  // Get the profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .eq('id', mvpId)
    .maybeSingle();

  return profile ? { ...profile, wins: maxWins } : null;
}

export async function getClubMVP(clubId: string, startDate?: string, endDate?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('player_game_stats')
    .select('user_id, result, match_date')
    .eq('club_id', clubId);

  if (startDate) query = query.gte('match_date', startDate);
  if (endDate) query = query.lte('match_date', endDate);

  const { data } = await query;

  if (!data || data.length === 0) return null;

  const winCounts: Record<string, number> = {};
  for (const stat of data) {
    if (stat.result === 'win') {
      winCounts[stat.user_id] = (winCounts[stat.user_id] || 0) + 1;
    }
  }

  let mvpId: string | null = null;
  let maxWins = 0;
  for (const [userId, wins] of Object.entries(winCounts)) {
    if (wins > maxWins) {
      maxWins = wins;
      mvpId = userId;
    }
  }

  if (!mvpId) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, ntrp_level')
    .eq('id', mvpId)
    .maybeSingle();

  return profile ? { ...profile, wins: maxWins } : null;
}
