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

  if (!data) return { wins: 0, losses: 0, total: 0, winRate: 0 };

  const wins = data.filter((g) => g.result === 'win').length;
  const losses = data.filter((g) => g.result === 'loss').length;
  const total = wins + losses;

  return {
    wins,
    losses,
    total,
    winRate: total > 0 ? Math.round((wins / total) * 100) : 0,
  };
}

export async function getPlayerRecentGames(userId: string, limit: number = 10, clubId?: string) {
  const supabase = await createClient();

  let query = supabase
    .from('player_game_stats')
    .select('*')
    .eq('user_id', userId)
    .not('result', 'is', null);

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
      result: game.result as 'win' | 'loss',
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
    .select('user_id, result')
    .eq('club_id', clubId)
    .not('result', 'is', null);

  if (!data || data.length === 0) return [];

  // Aggregate stats per player
  const playerStats: Record<string, { wins: number; losses: number; total: number }> = {};

  for (const row of data) {
    if (!playerStats[row.user_id]) {
      playerStats[row.user_id] = { wins: 0, losses: 0, total: 0 };
    }
    const stats = playerStats[row.user_id];
    if (row.result === 'win') {
      stats.wins++;
    } else {
      stats.losses++;
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

  // Build leaderboard sorted by win rate (min 1 game), then by total games
  return userIds
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
        total: stats.total,
        winRate: stats.total > 0 ? Math.round((stats.wins / stats.total) * 100) : 0,
      };
    })
    .sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.total - a.total;
    });
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
    .single();

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
    .single();

  return profile ? { ...profile, wins: maxWins } : null;
}
