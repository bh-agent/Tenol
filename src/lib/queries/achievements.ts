import { createClient } from '@/lib/supabase/server';
import { getClubMvp } from './mvp';

export type AchievementType =
  | 'current_mvp'
  | 'all_time_mvp'
  | 'most_games'
  | 'win_streak'
  | 'iron_man'
  | 'social_butterfly'
  | 'rookie_star'
  | 'ace';

export type Achievement = {
  type: AchievementType;
  label: string;
  emoji: string;
  description: string;
  criteria: string;
  user_id: string;
  display_name: string;
  value: number;
};

const ACHIEVEMENT_META: Record<
  AchievementType,
  { label: string; emoji: string; description: string; criteria: string }
> = {
  current_mvp: {
    label: '이번 달 MVP',
    emoji: '\u{1F3C6}',
    description: '이번 달 가장 높은 득점을 기록한 선수',
    criteria: '이번 달 가장 많은 점수를 획득한 선수 (최소 3경기 이상)',
  },
  all_time_mvp: {
    label: '통합 MVP',
    emoji: '\u{1F451}',
    description: '역대 최고 득점 선수',
    criteria: '전체 기간 가장 많은 점수를 획득한 선수 (최소 3경기 이상)',
  },
  most_games: {
    label: '최다 참여',
    emoji: '\u{1F4AA}',
    description: '가장 많은 경기에 참여한 선수',
    criteria: '가장 많은 경기에 참여한 선수 (최소 5경기 이상)',
  },
  win_streak: {
    label: '연승왕',
    emoji: '\u{1F525}',
    description: '가장 긴 연속 승리 기록 보유자',
    criteria: '가장 긴 연속 승리 기록 보유자 (최소 3연승)',
  },
  iron_man: {
    label: '개근왕',
    emoji: '\u{1F9BE}',
    description: '이번 달 가장 많은 매치에 참석한 선수',
    criteria: '이번 달 가장 많은 경기에 참석한 선수 (최소 2경기)',
  },
  social_butterfly: {
    label: '소셜왕',
    emoji: '\u{1F98B}',
    description: '가장 많은 상대와 경기한 선수',
    criteria: '가장 다양한 상대와 경기한 선수 (최소 3명 이상)',
  },
  rookie_star: {
    label: '루키왕',
    emoji: '\u{2B50}',
    description: '가입 30일 이내 최고의 신입',
    criteria: '가입 30일 이내 가장 좋은 성적의 신입 (최소 3경기 이상)',
  },
  ace: {
    label: '에이스',
    emoji: '\u{1F3AF}',
    description: '단일 경기 최고 득점 기록 보유자',
    criteria: '단일 경기 최고 점수 기록 보유자 (최소 6점 이상)',
  },
};

function makeAchievement(
  type: AchievementType,
  userId: string,
  displayName: string,
  value: number
): Achievement {
  const meta = ACHIEVEMENT_META[type];
  return {
    type,
    label: meta.label,
    emoji: meta.emoji,
    description: meta.description,
    criteria: meta.criteria,
    user_id: userId,
    display_name: displayName,
    value,
  };
}

/** Get all achievement types with their metadata (for info modal) */
export function getAllAchievementMeta(): Array<{
  type: AchievementType;
  label: string;
  emoji: string;
  description: string;
  criteria: string;
}> {
  return (Object.keys(ACHIEVEMENT_META) as AchievementType[]).map((type) => ({
    type,
    ...ACHIEVEMENT_META[type],
  }));
}

export async function getClubAchievements(
  clubId: string
): Promise<Achievement[]> {
  const supabase = await createClient();
  const achievements: Achievement[] = [];

  // Fetch all game stats for the club
  const { data: allStats } = await supabase
    .from('player_game_stats')
    .select(
      'user_id, game_id, match_id, result, score_team_a, score_team_b, team, match_date'
    )
    .eq('club_id', clubId)
    .not('score_team_a', 'is', null);

  if (!allStats || allStats.length === 0) return [];

  // Get all user IDs for profile lookup
  const allUserIds = [...new Set(allStats.map((s) => s.user_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, ntrp_level')
    .in('id', allUserIds);
  const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
  const getName = (uid: string) =>
    profileMap.get(uid)?.display_name || '알 수 없음';

  // ── MVP (동점자 모두 부여) — month/all 독립 조회 병렬화 ──
  const [monthMvps, allTimeMvps] = await Promise.all([
    getClubMvp(clubId, 'month'),
    getClubMvp(clubId, 'all'),
  ]);

  const monthMvpIds = new Set<string>();
  for (const mvp of monthMvps) {
    if (mvp.games_played >= 3) {
      achievements.push(makeAchievement('current_mvp', mvp.user_id, mvp.display_name, mvp.total_score));
      monthMvpIds.add(mvp.user_id);
    }
  }

  for (const mvp of allTimeMvps) {
    if (mvp.games_played >= 3) {
      achievements.push(makeAchievement('all_time_mvp', mvp.user_id, mvp.display_name, mvp.total_score));
    }
  }

  // ── most_games ──
  const gameCountByUser: Record<string, number> = {};
  for (const s of allStats) {
    gameCountByUser[s.user_id] = (gameCountByUser[s.user_id] || 0) + 1;
  }
  const maxGameCount = Math.max(...Object.values(gameCountByUser), 0);
  if (maxGameCount >= 5) {
    // 동점자 모두 부여
    for (const [uid, count] of Object.entries(gameCountByUser)) {
      if (count === maxGameCount) {
        achievements.push(makeAchievement('most_games', uid, getName(uid), count));
      }
    }
  }

  // ── win_streak ──
  // Group games by user, sorted by match_date
  const userGames: Record<string, { result: string; date: string }[]> = {};
  for (const s of allStats) {
    if (!userGames[s.user_id]) userGames[s.user_id] = [];
    userGames[s.user_id].push({
      result: s.result!,
      date: s.match_date,
    });
  }

  let bestStreak = 0;
  const streakPerUser: Record<string, number> = {};
  for (const [uid, games] of Object.entries(userGames)) {
    games.sort((a, b) => a.date.localeCompare(b.date));
    let currentStreak = 0;
    let maxStreak = 0;
    for (const g of games) {
      if (g.result === 'win') {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    streakPerUser[uid] = maxStreak;
    if (maxStreak > bestStreak) bestStreak = maxStreak;
  }
  if (bestStreak >= 3) {
    // 동점자 모두 부여
    for (const [uid, streak] of Object.entries(streakPerUser)) {
      if (streak === bestStreak) {
        achievements.push(makeAchievement('win_streak', uid, getName(uid), streak));
      }
    }
  }

  // ── iron_man ── (most distinct matches this month)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const monthStr = thirtyDaysAgo.toISOString().split('T')[0];

  const monthStats = allStats.filter((s) => s.match_date >= monthStr);
  const matchesByUser: Record<string, Set<string>> = {};
  for (const s of monthStats) {
    if (!matchesByUser[s.user_id]) matchesByUser[s.user_id] = new Set();
    matchesByUser[s.user_id].add(s.match_id);
  }
  let ironManUser = '';
  let ironManCount = 0;
  for (const [uid, matchSet] of Object.entries(matchesByUser)) {
    if (matchSet.size > ironManCount) {
      ironManCount = matchSet.size;
      ironManUser = uid;
    }
  }
  if (ironManCount >= 2) {
    achievements.push(
      makeAchievement(
        'iron_man',
        ironManUser,
        getName(ironManUser),
        ironManCount
      )
    );
  }

  // ── social_butterfly ── (most distinct opponents)
  // We need to figure out opponents from game data
  // Fetch all completed games for the club
  const { data: allGames } = await supabase
    .from('games')
    .select(
      'id, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id, draw_id, status'
    )
    .eq('status', 'completed');

  if (allGames && allGames.length > 0) {
    // Get draws for this club
    const { data: draws } = await supabase
      .from('draws')
      .select('id, match_id')
      .in(
        'match_id',
        [...new Set(allStats.map((s) => s.match_id))]
      );

    const clubDrawIds = new Set(draws?.map((d) => d.id) || []);
    const clubGames = allGames.filter((g) => clubDrawIds.has(g.draw_id));

    // Get participant -> user_id mapping
    const participantIds = new Set<string>();
    for (const g of clubGames) {
      if (g.team_a_player1_id) participantIds.add(g.team_a_player1_id);
      if (g.team_a_player2_id) participantIds.add(g.team_a_player2_id);
      if (g.team_b_player1_id) participantIds.add(g.team_b_player1_id);
      if (g.team_b_player2_id) participantIds.add(g.team_b_player2_id);
    }

    const { data: participants } = await supabase
      .from('match_participants')
      .select('id, user_id')
      .in('id', [...participantIds]);

    const partToUser = new Map<string, string>();
    for (const p of participants || []) {
      if (p.user_id) partToUser.set(p.id, p.user_id);
    }

    // For each game, find who played against whom
    const opponentsByUser: Record<string, Set<string>> = {};
    for (const g of clubGames) {
      const teamA = [g.team_a_player1_id, g.team_a_player2_id]
        .filter(Boolean)
        .map((pid) => partToUser.get(pid!))
        .filter(Boolean) as string[];
      const teamB = [g.team_b_player1_id, g.team_b_player2_id]
        .filter(Boolean)
        .map((pid) => partToUser.get(pid!))
        .filter(Boolean) as string[];

      // Team A players have Team B as opponents
      for (const uid of teamA) {
        if (!opponentsByUser[uid]) opponentsByUser[uid] = new Set();
        for (const opp of teamB) opponentsByUser[uid].add(opp);
      }
      // Team B players have Team A as opponents
      for (const uid of teamB) {
        if (!opponentsByUser[uid]) opponentsByUser[uid] = new Set();
        for (const opp of teamA) opponentsByUser[uid].add(opp);
      }
    }

    let socialUser = '';
    let socialCount = 0;
    for (const [uid, oppSet] of Object.entries(opponentsByUser)) {
      if (oppSet.size > socialCount) {
        socialCount = oppSet.size;
        socialUser = uid;
      }
    }
    if (socialCount >= 3) {
      achievements.push(
        makeAchievement(
          'social_butterfly',
          socialUser,
          getName(socialUser),
          socialCount
        )
      );
    }
  }

  // ── rookie_star ── (best win rate among members who joined < 30 days ago, min 3 games)
  const { data: recentMembers } = await supabase
    .from('club_members')
    .select('user_id, joined_at')
    .eq('club_id', clubId)
    .gte('joined_at', new Date(Date.now() - 30 * 86400000).toISOString());

  if (recentMembers && recentMembers.length > 0) {
    const rookieIds = new Set(recentMembers.map((m) => m.user_id));
    const rookieStats: Record<string, { wins: number; total: number }> = {};
    for (const s of allStats) {
      if (!rookieIds.has(s.user_id)) continue;
      if (!rookieStats[s.user_id])
        rookieStats[s.user_id] = { wins: 0, total: 0 };
      rookieStats[s.user_id].total++;
      if (s.result === 'win') rookieStats[s.user_id].wins++;
    }

    let bestRookieId = '';
    let bestRookieRate = 0;
    let bestRookieGames = 0;
    for (const [uid, st] of Object.entries(rookieStats)) {
      if (st.total < 3) continue;
      const rate = st.wins / st.total;
      if (
        rate > bestRookieRate ||
        (rate === bestRookieRate && st.total > bestRookieGames)
      ) {
        bestRookieRate = rate;
        bestRookieId = uid;
        bestRookieGames = st.total;
      }
    }

    if (bestRookieId) {
      achievements.push(
        makeAchievement(
          'rookie_star',
          bestRookieId,
          getName(bestRookieId),
          Math.round(bestRookieRate * 100)
        )
      );
    }
  }

  // ── ace ── (highest single-game score by any player)
  let aceUser = '';
  let aceScore = 0;
  for (const s of allStats) {
    const myScore =
      s.team === 'team_a' ? s.score_team_a : s.score_team_b;
    if (myScore !== null && myScore > aceScore) {
      aceScore = myScore;
      aceUser = s.user_id;
    }
  }
  if (aceScore >= 6 && aceUser) {
    achievements.push(
      makeAchievement('ace', aceUser, getName(aceUser), aceScore)
    );
  }


  return achievements;
}

/** Get achievement badges for a specific user in a club */
export async function getUserAchievements(
  clubId: string,
  userId: string
): Promise<Achievement[]> {
  const all = await getClubAchievements(clubId);
  return all.filter((a) => a.user_id === userId);
}
