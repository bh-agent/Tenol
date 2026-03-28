import { createClient } from '@/lib/supabase/server';

export type HeadToHeadResult = {
  player1Wins: number;
  player2Wins: number;
  totalGames: number;
  recentGames: {
    gameId: string;
    matchDate: string;
    scoreTeamA: number | null;
    scoreTeamB: number | null;
    winner: 'player1' | 'player2' | null;
  }[];
};

export async function getHeadToHead(
  clubId: string,
  player1Id: string,
  player2Id: string
): Promise<HeadToHeadResult> {
  const supabase = await createClient();

  // Get all completed games in this club where both players participated
  // First get all draws from matches in this club
  const { data: matches } = await supabase
    .from('matches')
    .select('id')
    .eq('club_id', clubId);

  if (!matches || matches.length === 0) {
    return { player1Wins: 0, player2Wins: 0, totalGames: 0, recentGames: [] };
  }

  const matchIds = matches.map((m) => m.id);

  // Get participant IDs for both players across all matches
  const { data: allParticipants } = await supabase
    .from('match_participants')
    .select('id, match_id, user_id')
    .in('match_id', matchIds)
    .in('user_id', [player1Id, player2Id]);

  if (!allParticipants || allParticipants.length === 0) {
    return { player1Wins: 0, player2Wins: 0, totalGames: 0, recentGames: [] };
  }

  // Group participant IDs by match, keyed by user
  const matchParticipantMap: Record<string, { p1Ids: string[]; p2Ids: string[] }> = {};
  for (const p of allParticipants) {
    if (!matchParticipantMap[p.match_id]) {
      matchParticipantMap[p.match_id] = { p1Ids: [], p2Ids: [] };
    }
    if (p.user_id === player1Id) {
      matchParticipantMap[p.match_id].p1Ids.push(p.id);
    } else if (p.user_id === player2Id) {
      matchParticipantMap[p.match_id].p2Ids.push(p.id);
    }
  }

  // Only consider matches where both players have participants
  const relevantMatchIds = Object.keys(matchParticipantMap).filter(
    (mId) =>
      matchParticipantMap[mId].p1Ids.length > 0 &&
      matchParticipantMap[mId].p2Ids.length > 0
  );

  if (relevantMatchIds.length === 0) {
    return { player1Wins: 0, player2Wins: 0, totalGames: 0, recentGames: [] };
  }

  // Get draws for relevant matches
  const { data: draws } = await supabase
    .from('draws')
    .select('id, match_id')
    .in('match_id', relevantMatchIds);

  if (!draws || draws.length === 0) {
    return { player1Wins: 0, player2Wins: 0, totalGames: 0, recentGames: [] };
  }

  const drawIds = draws.map((d) => d.id);
  const drawMatchMap = new Map(draws.map((d) => [d.id, d.match_id]));

  // Get all completed games from these draws
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .in('draw_id', drawIds)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });

  if (!games || games.length === 0) {
    return { player1Wins: 0, player2Wins: 0, totalGames: 0, recentGames: [] };
  }

  // Collect all participant IDs for both players
  const p1AllIds = new Set<string>();
  const p2AllIds = new Set<string>();
  for (const entry of Object.values(matchParticipantMap)) {
    entry.p1Ids.forEach((id) => p1AllIds.add(id));
    entry.p2Ids.forEach((id) => p2AllIds.add(id));
  }

  // Filter games where both players are on OPPOSITE teams
  let player1Wins = 0;
  let player2Wins = 0;
  const headToHeadGames: HeadToHeadResult['recentGames'] = [];

  for (const game of games) {
    const teamAPlayers = [game.team_a_player1_id, game.team_a_player2_id].filter(Boolean) as string[];
    const teamBPlayers = [game.team_b_player1_id, game.team_b_player2_id].filter(Boolean) as string[];

    const p1InA = teamAPlayers.some((id) => p1AllIds.has(id));
    const p1InB = teamBPlayers.some((id) => p1AllIds.has(id));
    const p2InA = teamAPlayers.some((id) => p2AllIds.has(id));
    const p2InB = teamBPlayers.some((id) => p2AllIds.has(id));

    // They must be on opposite teams
    const onOppositeTeams = (p1InA && p2InB) || (p1InB && p2InA);
    if (!onOppositeTeams) continue;

    let winner: 'player1' | 'player2' | null = null;
    if (game.winner === 'team_a') {
      winner = p1InA ? 'player1' : 'player2';
    } else if (game.winner === 'team_b') {
      winner = p1InB ? 'player1' : 'player2';
    }

    if (winner === 'player1') player1Wins++;
    else if (winner === 'player2') player2Wins++;

    // Get match date for this game
    const matchId = drawMatchMap.get(game.draw_id);
    const matchEntry = matches.find((m) => m.id === matchId);

    headToHeadGames.push({
      gameId: game.id,
      matchDate: game.completed_at || game.created_at,
      scoreTeamA: game.score_team_a,
      scoreTeamB: game.score_team_b,
      winner,
    });
  }

  return {
    player1Wins,
    player2Wins,
    totalGames: headToHeadGames.length,
    recentGames: headToHeadGames.slice(0, 3),
  };
}
