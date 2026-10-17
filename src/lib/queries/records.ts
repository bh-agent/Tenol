import { createClient } from '@/lib/supabase/server';
import { getClubMemberIds } from './member-ids';

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

  const [{ data: allStats }, memberIds] = await Promise.all([
    supabase
      .from('player_game_stats')
      .select('*')
      .eq('club_id', clubId)
      .not('score_team_a', 'is', null)
      .order('match_date', { ascending: true }),
    getClubMemberIds(clubId),
  ]);

  // 클럽 기록은 회원만 (게스트 참가 계정 제외)
  const rawStats = (allStats ?? []).filter((s) => memberIds.has(s.user_id));

  if (rawStats.length === 0) return [];

  // 같은 날 여러 게임의 순서가 DB 반환 순서에 따라 뒤섞이면 연승 계산이 흔들린다.
  // match_date → completed_at → game_order → court_number 순으로 결정적 정렬.
  // (뷰 확장 컬럼은 00048/00052 적용 전 DB에서는 undefined → 0으로 취급)
  type Ordered = { match_date: string; completed_at?: string | null; game_order?: number | null; court_number?: number | null };
  const statsData = [...rawStats].sort((a: Ordered, b: Ordered) => {
    if (a.match_date !== b.match_date) return a.match_date < b.match_date ? -1 : 1;
    const ca = a.completed_at ?? '';
    const cb = b.completed_at ?? '';
    if (ca !== cb) return ca < cb ? -1 : 1;
    const ga = a.game_order ?? 0;
    const gb = b.game_order ?? 0;
    if (ga !== gb) return ga - gb;
    return (a.court_number ?? 0) - (b.court_number ?? 0);
  });

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

  // 1. Highest single game score (최고 점수 기록) — 동점자 모두 표시
  let highestScore = 0;
  for (const stat of statsData) {
    const myScore = stat.team === 'team_a' ? stat.score_team_a : stat.score_team_b;
    if (myScore !== null && myScore > highestScore) highestScore = myScore;
  }
  if (highestScore > 0) {
    const holders = statsData.filter((s) => {
      const myScore = s.team === 'team_a' ? s.score_team_a : s.score_team_b;
      return myScore === highestScore;
    });
    const holderNames = [...new Set(holders.map((h) => profileMap.get(h.user_id)?.name || '알 수 없음'))];
    const firstHolder = holders[0];
    records.push({
      type: 'highest_score',
      emoji: '🎯',
      title: '최고 점수 기록',
      holderName: holderNames.join(', '),
      holderAvatarUrl: profileMap.get(firstHolder.user_id)?.avatarUrl || null,
      value: `${highestScore}점`,
      date: firstHolder.match_date,
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
  const streakByUser: Record<string, { streak: number; endDate: string | null }> = {};

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

    streakByUser[userId] = { streak: bestStreak, endDate: bestEndDate };
    if (bestStreak > longestStreak) longestStreak = bestStreak;
  }

  if (longestStreak >= 2) {
    // 동점자 모두 표시
    const holders = Object.entries(streakByUser).filter(([, v]) => v.streak === longestStreak);
    const holderNames = holders.map(([uid]) => profileMap.get(uid)?.name || '알 수 없음');
    records.push({
      type: 'longest_streak',
      emoji: '🔥',
      title: '최장 연승 기록',
      holderName: holderNames.join(', '),
      holderAvatarUrl: profileMap.get(holders[0][0])?.avatarUrl || null,
      value: `${longestStreak}연승`,
      date: holders[0][1].endDate,
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

  // player_game_stats는 "선수 × 게임" 행이라 복식 한 게임이 4행으로 잡힌다.
  // 날짜별 '경기 수'는 game_id를 중복 제거해 센다. (점수 입력 여부와 무관하게 대진표상 게임 수)
  const { data } = await supabase
    .from('player_game_stats')
    .select('match_date, game_id')
    .eq('club_id', clubId)
    .gte('match_date', startDate)
    .lt('match_date', endDate);

  if (!data || data.length === 0) return {};

  const gamesByDate: Record<string, Set<string>> = {};
  for (const row of data) {
    (gamesByDate[row.match_date] ??= new Set()).add(row.game_id);
  }

  const activity: Record<string, number> = {};
  for (const [date, games] of Object.entries(gamesByDate)) {
    activity[date] = games.size;
  }

  return activity;
}
