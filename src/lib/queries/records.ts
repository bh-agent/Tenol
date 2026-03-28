import { createClient } from '@/lib/supabase/server';

export type ClubRecord = {
  type: 'highest_score' | 'longest_streak' | 'most_games_day' | 'most_active_month';
  emoji: string;
  title: string;
  holderName: string;
  holderAvatarUrl: string | null;
  value: string;
  date: string | null;
};

export async function getClubRecords(clubId: string): Promise<ClubRecord[]> {
  const supabase = await createClient();

  const { data: statsData } = await supabase
    .from('player_game_stats')
    .select('*')
    .eq('club_id', clubId)
    .not('result', 'is', null)
    .order('match_date', { ascending: true });

  if (!statsData || statsData.length === 0) return [];

  // Collect all user IDs to fetch profiles
  const userIds = [...new Set(statsData.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map(
    profiles?.map((p) => [p.id, { name: p.display_name, avatarUrl: p.avatar_url }]) || []
  );

  const records: ClubRecord[] = [];

  // 1. Highest single game score (최고 점수 기록)
  let highestScore = 0;
  let highestScoreUserId: string | null = null;
  let highestScoreDate: string | null = null;

  for (const stat of statsData) {
    const myScore =
      stat.team === 'team_a' ? stat.score_team_a : stat.score_team_b;
    if (myScore !== null && myScore > highestScore) {
      highestScore = myScore;
      highestScoreUserId = stat.user_id;
      highestScoreDate = stat.match_date;
    }
  }

  if (highestScoreUserId) {
    const profile = profileMap.get(highestScoreUserId);
    records.push({
      type: 'highest_score',
      emoji: '🎯',
      title: '최고 점수 기록',
      holderName: profile?.name || '알 수 없음',
      holderAvatarUrl: profile?.avatarUrl || null,
      value: `${highestScore}점`,
      date: highestScoreDate,
    });
  }

  // 2. Longest win streak (최장 연승 기록)
  const userGames: Record<string, { result: string; date: string }[]> = {};
  for (const stat of statsData) {
    if (!userGames[stat.user_id]) userGames[stat.user_id] = [];
    userGames[stat.user_id].push({
      result: stat.result as string,
      date: stat.match_date,
    });
  }

  let longestStreak = 0;
  let streakUserId: string | null = null;
  let streakEndDate: string | null = null;

  for (const [userId, games] of Object.entries(userGames)) {
    let currentStreak = 0;
    let bestStreak = 0;
    let bestEndDate: string | null = null;

    for (const game of games) {
      if (game.result === 'win') {
        currentStreak++;
        if (currentStreak > bestStreak) {
          bestStreak = currentStreak;
          bestEndDate = game.date;
        }
      } else {
        currentStreak = 0;
      }
    }

    if (bestStreak > longestStreak) {
      longestStreak = bestStreak;
      streakUserId = userId;
      streakEndDate = bestEndDate;
    }
  }

  if (streakUserId && longestStreak >= 2) {
    const profile = profileMap.get(streakUserId);
    records.push({
      type: 'longest_streak',
      emoji: '🔥',
      title: '최장 연승 기록',
      holderName: profile?.name || '알 수 없음',
      holderAvatarUrl: profile?.avatarUrl || null,
      value: `${longestStreak}연승`,
      date: streakEndDate,
    });
  }

  // 3. Most games in a single day (하루 최다 경기)
  const dayGames: Record<string, Record<string, number>> = {}; // userId -> date -> count
  for (const stat of statsData) {
    if (!dayGames[stat.user_id]) dayGames[stat.user_id] = {};
    dayGames[stat.user_id][stat.match_date] =
      (dayGames[stat.user_id][stat.match_date] || 0) + 1;
  }

  let mostGamesDay = 0;
  let mostGamesDayUserId: string | null = null;
  let mostGamesDayDate: string | null = null;

  for (const [userId, dates] of Object.entries(dayGames)) {
    for (const [date, count] of Object.entries(dates)) {
      if (count > mostGamesDay) {
        mostGamesDay = count;
        mostGamesDayUserId = userId;
        mostGamesDayDate = date;
      }
    }
  }

  if (mostGamesDayUserId && mostGamesDay >= 2) {
    const profile = profileMap.get(mostGamesDayUserId);
    records.push({
      type: 'most_games_day',
      emoji: '💪',
      title: '하루 최다 경기',
      holderName: profile?.name || '알 수 없음',
      holderAvatarUrl: profile?.avatarUrl || null,
      value: `${mostGamesDay}경기`,
      date: mostGamesDayDate,
    });
  }

  // 4. Most active month (가장 활발한 달)
  const monthGames: Record<string, Record<string, number>> = {}; // userId -> YYYY-MM -> count
  for (const stat of statsData) {
    const month = stat.match_date.slice(0, 7); // YYYY-MM
    if (!monthGames[stat.user_id]) monthGames[stat.user_id] = {};
    monthGames[stat.user_id][month] =
      (monthGames[stat.user_id][month] || 0) + 1;
  }

  let mostActiveMonth = 0;
  let mostActiveMonthUserId: string | null = null;
  let mostActiveMonthDate: string | null = null;

  for (const [userId, months] of Object.entries(monthGames)) {
    for (const [month, count] of Object.entries(months)) {
      if (count > mostActiveMonth) {
        mostActiveMonth = count;
        mostActiveMonthUserId = userId;
        mostActiveMonthDate = month;
      }
    }
  }

  if (mostActiveMonthUserId && mostActiveMonth >= 2) {
    const profile = profileMap.get(mostActiveMonthUserId);
    // Format month nicely
    const [year, month] = (mostActiveMonthDate || '').split('-');
    const monthLabel = year && month ? `${year}년 ${parseInt(month)}월` : '';
    records.push({
      type: 'most_active_month',
      emoji: '⭐',
      title: '가장 활발한 달',
      holderName: profile?.name || '알 수 없음',
      holderAvatarUrl: profile?.avatarUrl || null,
      value: `${mostActiveMonth}경기`,
      date: monthLabel || mostActiveMonthDate,
    });
  }

  return records;
}

export async function getClubActivityCalendar(
  clubId: string,
  year: number,
  month: number
): Promise<Record<string, number>> {
  const supabase = await createClient();

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endYear = month === 12 ? year + 1 : year;
  const endMonth = month === 12 ? 1 : month + 1;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  const { data } = await supabase
    .from('player_game_stats')
    .select('match_date')
    .eq('club_id', clubId)
    .gte('match_date', startDate)
    .lt('match_date', endDate);

  if (!data || data.length === 0) return {};

  const activity: Record<string, number> = {};
  for (const row of data) {
    activity[row.match_date] = (activity[row.match_date] || 0) + 1;
  }

  return activity;
}
