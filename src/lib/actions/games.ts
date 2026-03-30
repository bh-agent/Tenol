'use server';

import { createClient } from '@/lib/supabase/server';
import {
  submitScoreSchema,
  updateGamePlayersSchema,
  deleteDrawSchema,
} from '@/lib/validations';

// 권한은 RLS + 프론트에서 체크하되, 서버에서도 game의 match -> club 경로로 검증
async function getClubIdFromGame(gameId: string): Promise<string> {
  const supabase = await createClient();

  const { data: game } = await supabase
    .from('games')
    .select('draw_id')
    .eq('id', gameId)
    .maybeSingle();
  if (!game) throw new Error('게임을 찾을 수 없습니다');

  const { data: draw } = await supabase
    .from('draws')
    .select('match_id')
    .eq('id', game.draw_id)
    .maybeSingle();
  if (!draw) throw new Error('대진표를 찾을 수 없습니다');

  const { data: match } = await supabase
    .from('matches')
    .select('club_id')
    .eq('id', draw.match_id)
    .maybeSingle();
  if (!match) throw new Error('경기를 찾을 수 없습니다');

  return match.club_id;
}

// Helper: get match status from a game ID using an existing supabase client
async function getMatchStatusFromGame(supabase: any, gameId: string): Promise<string | null> {
  const { data: game } = await supabase
    .from('games')
    .select('draw_id')
    .eq('id', gameId)
    .maybeSingle();
  if (!game) return null;

  const { data: draw } = await supabase
    .from('draws')
    .select('match_id')
    .eq('id', game.draw_id)
    .maybeSingle();
  if (!draw) return null;

  const { data: match } = await supabase
    .from('matches')
    .select('status')
    .eq('id', draw.match_id)
    .maybeSingle();
  return match?.status || null;
}

// draw.manage 권한 필요 - 대진표 삭제 (CASCADE로 games도 삭제됨)
export async function deleteDraw(drawId: string, matchId: string) {
  const validated = deleteDrawSchema.parse({ drawId, matchId });

  const { requireMatchPermission } = await import('@/lib/utils/check-permission');
  await requireMatchPermission(validated.matchId, 'draw.manage');

  const supabase = await createClient();

  // draws 삭제 (games는 ON DELETE CASCADE로 자동 삭제)
  const { error } = await supabase
    .from('draws')
    .delete()
    .eq('id', validated.drawId)
    .eq('match_id', validated.matchId);

  if (error) throw new Error('대진표 삭제에 실패했습니다');
}

// result.input 권한 필요 (회장, 운영진, 멤버)
export async function submitScore(
  gameId: string,
  scoreA: number,
  scoreB: number
) {
  const validated = submitScoreSchema.parse({ gameId, scoreA, scoreB });

  const { requirePermission } = await import('@/lib/utils/check-permission');
  const clubId = await getClubIdFromGame(validated.gameId);
  await requirePermission(clubId, 'result.input');

  const supabase = await createClient();

  // Check that the match is in a scorable state (in_progress or completed for corrections)
  const matchStatusForGame = await getMatchStatusFromGame(supabase, validated.gameId);
  if (matchStatusForGame === 'upcoming') {
    throw new Error('아직 시작되지 않은 경기에는 점수를 입력할 수 없습니다');
  }
  if (matchStatusForGame === 'cancelled') {
    throw new Error('취소된 경기에는 점수를 입력할 수 없습니다');
  }

  const winner = validated.scoreA > validated.scoreB ? 'team_a' : validated.scoreB > validated.scoreA ? 'team_b' : null;

  // 게임 정보 조회 (알림 전송용)
  const { data: gameData } = await supabase
    .from('games')
    .select('draw_id, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id')
    .eq('id', validated.gameId)
    .maybeSingle();

  const { error } = await supabase
    .from('games')
    .update({
      score_team_a: validated.scoreA,
      score_team_b: validated.scoreB,
      winner,
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', validated.gameId);

  if (error) throw new Error('점수 저장에 실패했습니다');

  // 점수 입력 알림 전송
  try {
    if (gameData) {
      const playerIds = [
        gameData.team_a_player1_id,
        gameData.team_a_player2_id,
        gameData.team_b_player1_id,
        gameData.team_b_player2_id,
      ].filter(Boolean) as string[];

      const { data: participants } = await supabase
        .from('match_participants')
        .select('id, user_id')
        .in('id', playerIds);

      const { data: draw } = await supabase
        .from('draws')
        .select('match_id')
        .eq('id', gameData.draw_id)
        .single();

      if (participants && draw) {
        const { data: match } = await supabase
          .from('matches')
          .select('title, club_id')
          .eq('id', draw.match_id)
          .single();

        if (match) {
          const { data: { user } } = await supabase.auth.getUser();
          const { createNotification } = await import('@/lib/actions/notifications');

          for (const p of participants) {
            if (p.user_id && p.user_id !== user?.id) {
              await createNotification(
                p.user_id,
                'score_updated',
                '점수가 입력되었습니다',
                `"${match.title}" 경기의 점수가 업데이트되었습니다. (${validated.scoreA}:${validated.scoreB})`,
                { match_id: draw.match_id, club_id: match.club_id }
              ).catch(() => {});
            }
          }
        }
      }
    }
  } catch {
    // 알림 전송 실패해도 점수 저장은 이미 완료됨
  }
}

// draw.manage 권한 필요 - 수동 대진표 생성
export async function createManualDraw(
  matchId: string,
  drawType: string,
  games: {
    court_number: number;
    game_order: number;
    team_a_player1_id: string | null;
    team_a_player2_id: string | null;
    team_b_player1_id: string | null;
    team_b_player2_id: string | null;
  }[]
) {
  const { requireMatchPermission } = await import('@/lib/utils/check-permission');
  const { userId } = await requireMatchPermission(matchId, 'draw.manage');

  const supabase = await createClient();

  // Delete existing draw for round 1
  await supabase
    .from('draws')
    .delete()
    .eq('match_id', matchId)
    .eq('round_number', 1);

  // Create draw record
  const { data: draw, error: drawError } = await supabase
    .from('draws')
    .insert({
      match_id: matchId,
      round_number: 1,
      draw_type: drawType,
      created_by: userId,
    })
    .select()
    .single();

  if (drawError) throw new Error('대진표 생성에 실패했습니다');

  // Insert games
  const gameInserts = games.map((g) => ({
    draw_id: draw.id,
    court_number: g.court_number,
    game_order: g.game_order,
    team_a_player1_id: g.team_a_player1_id,
    team_a_player2_id: g.team_a_player2_id,
    team_b_player1_id: g.team_b_player1_id,
    team_b_player2_id: g.team_b_player2_id,
  }));

  const { error: gamesError } = await supabase
    .from('games')
    .insert(gameInserts);

  if (gamesError) throw new Error('게임 저장에 실패했습니다');

  return { drawId: draw.id, gameCount: games.length };
}

// draw.manage 권한 필요 (회장, 운영진, 멤버)
export async function updateGamePlayers(
  gameId: string,
  data: {
    team_a_player1_id?: string | null;
    team_a_player2_id?: string | null;
    team_b_player1_id?: string | null;
    team_b_player2_id?: string | null;
  }
) {
  const validated = updateGamePlayersSchema.parse({ gameId, data });

  const { requirePermission } = await import('@/lib/utils/check-permission');
  const clubId = await getClubIdFromGame(validated.gameId);
  await requirePermission(clubId, 'draw.manage');

  const supabase = await createClient();
  const { error } = await supabase
    .from('games')
    .update(validated.data)
    .eq('id', validated.gameId);

  if (error) throw new Error('선수 배정 수정에 실패했습니다');
}
