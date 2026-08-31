'use server';

import { ZodError } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  submitScoreSchema,
  updateGamePlayersSchema,
  deleteDrawSchema,
  addGameSchema,
  deleteGameSchema,
} from '@/lib/validations';

// 예상 가능한 에러를 사용자에게 그대로 전달하기 위한 정규화 헬퍼.
// Next.js 프로덕션은 서버 액션이 throw한 메시지를 가리고 generic 영어로 대체하므로,
// 액션은 throw 대신 { error } 를 반환하고 클라이언트가 이 문자열을 그대로 표시한다.
// (권한/상태 체크 등 내부 throw는 여기서 잡아 한국어 메시지를 보존한다.)
function actionError(e: unknown, fallback: string): { error: string } {
  if (e instanceof ZodError) return { error: fallback }; // 입력 검증 실패는 사용자 친화 메시지로
  return { error: e instanceof Error && e.message ? e.message : fallback };
}

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

async function getMatchIdFromGame(gameId: string): Promise<string> {
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

  return draw.match_id;
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
export async function deleteDraw(drawId: string, matchId: string): Promise<{ error?: string }> {
  try {
    const validated = deleteDrawSchema.parse({ drawId, matchId });

    // 종료된 대진은 회장·운영진만 삭제 가능 (개별 수정과 동일한 보호)
    const { requireMatchDrawEdit } = await import('@/lib/utils/check-permission');
    await requireMatchDrawEdit(validated.matchId);

    const supabase = await createClient();

    // draws 삭제 (games는 ON DELETE CASCADE로 자동 삭제)
    const { error } = await supabase
      .from('draws')
      .delete()
      .eq('id', validated.drawId)
      .eq('match_id', validated.matchId);

    if (error) return { error: '대진표 삭제에 실패했습니다' };
    return {};
  } catch (e) {
    return actionError(e, '대진표 삭제에 실패했습니다');
  }
}

// result.input 권한 필요 (회장, 운영진, 멤버)
export async function submitScore(gameId: string, scoreA: number, scoreB: number): Promise<{ error?: string }> {
  try {
    await submitScoreImpl(gameId, scoreA, scoreB);
    return {};
  } catch (e) {
    return actionError(e, '점수 저장에 실패했습니다');
  }
}

async function submitScoreImpl(
  gameId: string,
  scoreA: number,
  scoreB: number
) {
  const validated = submitScoreSchema.parse({ gameId, scoreA, scoreB });

  const { requirePermission } = await import('@/lib/utils/check-permission');
  const clubId = await getClubIdFromGame(validated.gameId);
  await requirePermission(clubId, 'result.input');

  const supabase = await createClient();

  // Check match status — auto-transition upcoming → in_progress on first score
  const matchStatusForGame = await getMatchStatusFromGame(supabase, validated.gameId);
  if (matchStatusForGame === 'cancelled') {
    throw new Error('취소된 경기에는 점수를 입력할 수 없습니다');
  }
  if (matchStatusForGame === 'upcoming') {
    const { data: game } = await supabase.from('games').select('draw_id').eq('id', validated.gameId).maybeSingle();
    if (game) {
      const { data: draw } = await supabase.from('draws').select('match_id').eq('id', game.draw_id).maybeSingle();
      if (draw) {
        await supabase.from('matches').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', draw.match_id);
      }
    }
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
        .maybeSingle();

      if (participants && draw) {
        const { data: match } = await supabase
          .from('matches')
          .select('title, club_id')
          .eq('id', draw.match_id)
          .maybeSingle();

        if (match) {
          const { data: { user } } = await supabase.auth.getUser();
          const { createNotification } = await import('@/lib/server/notify');

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
type ManualGameInput = {
  court_number: number;
  game_order: number;
  team_a_player1_id: string | null;
  team_a_player2_id: string | null;
  team_b_player1_id: string | null;
  team_b_player2_id: string | null;
};

export async function createManualDraw(matchId: string, drawType: string, games: ManualGameInput[]) {
  try {
    return await createManualDrawImpl(matchId, drawType, games);
  } catch (e) {
    return actionError(e, '대진표 저장에 실패했습니다');
  }
}

async function createManualDrawImpl(
  matchId: string,
  drawType: string,
  games: ManualGameInput[]
) {
  // 종료된 대진은 회장·운영진만 (수동 생성도 기존 대진·점수를 덮어쓰므로 보호)
  const { requireMatchDrawEdit } = await import('@/lib/utils/check-permission');
  const { userId } = await requireMatchDrawEdit(matchId);

  // 같은 선수를 한 경기의 두 슬롯, 또는 같은 시간대(game_order) 두 코트에 동시 배정 금지
  for (const g of games) {
    const ids = [g.team_a_player1_id, g.team_a_player2_id, g.team_b_player1_id, g.team_b_player2_id].filter(Boolean);
    if (new Set(ids).size !== ids.length) {
      throw new Error('한 경기에 같은 선수를 중복 배정할 수 없습니다');
    }
  }
  const bySlot = new Map<number, Set<string>>();
  for (const g of games) {
    const slot = bySlot.get(g.game_order) ?? new Set<string>();
    for (const id of [g.team_a_player1_id, g.team_a_player2_id, g.team_b_player1_id, g.team_b_player2_id]) {
      if (!id) continue;
      if (slot.has(id)) throw new Error('같은 시간대에 한 선수를 두 코트에 배정할 수 없습니다');
      slot.add(id);
    }
    bySlot.set(g.game_order, slot);
  }

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

// draw.manage 권한 필요 - 대진표에 개별 경기 추가 (빈 경기 → 이후 선수 배정)
// 지정 시간대(game_order)의 다음 코트 번호로 빈 경기를 하나 추가한다.
export async function addGame(matchId: string, drawId: string, gameOrder: number) {
  try {
    return await addGameImpl(matchId, drawId, gameOrder);
  } catch (e) {
    return actionError(e, '경기 추가에 실패했습니다');
  }
}

async function addGameImpl(matchId: string, drawId: string, gameOrder: number) {
  const validated = addGameSchema.parse({ matchId, drawId, gameOrder });

  const { requireMatchDrawEdit } = await import('@/lib/utils/check-permission');
  await requireMatchDrawEdit(validated.matchId);

  const supabase = await createClient();

  // 대진표가 이 매치의 것인지 확인
  const { data: draw } = await supabase
    .from('draws')
    .select('id, match_id')
    .eq('id', validated.drawId)
    .maybeSingle();
  if (!draw || draw.match_id !== validated.matchId) {
    throw new Error('대진표를 찾을 수 없습니다');
  }

  // 해당 시간대의 다음 코트 번호 계산 (경쟁 조건 방지 위해 서버에서 산출)
  const { data: existing } = await supabase
    .from('games')
    .select('court_number')
    .eq('draw_id', validated.drawId)
    .eq('game_order', validated.gameOrder);
  const nextCourt =
    existing && existing.length > 0
      ? Math.max(...existing.map((g) => g.court_number || 0)) + 1
      : 1;

  const { data: game, error } = await supabase
    .from('games')
    .insert({
      draw_id: validated.drawId,
      court_number: nextCourt,
      game_order: validated.gameOrder,
    })
    .select('id')
    .single();

  if (error) throw new Error('경기 추가에 실패했습니다');
  return { gameId: game.id, courtNumber: nextCourt, gameOrder: validated.gameOrder };
}

// draw.manage 권한 필요 - 개별 경기 삭제
export async function deleteGame(gameId: string): Promise<{ error?: string }> {
  try {
    const validated = deleteGameSchema.parse({ gameId });

    const { requireMatchDrawEdit } = await import('@/lib/utils/check-permission');
    const matchId = await getMatchIdFromGame(validated.gameId);
    await requireMatchDrawEdit(matchId);

    const supabase = await createClient();
    const { error } = await supabase.from('games').delete().eq('id', validated.gameId);

    if (error) return { error: '경기 삭제에 실패했습니다' };
    return {};
  } catch (e) {
    return actionError(e, '경기 삭제에 실패했습니다');
  }
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
): Promise<{ error?: string }> {
  try {
    const validated = updateGamePlayersSchema.parse({ gameId, data });

    const { requireMatchDrawEdit } = await import('@/lib/utils/check-permission');
    const matchId = await getMatchIdFromGame(validated.gameId);
    await requireMatchDrawEdit(matchId);

    const supabase = await createClient();
    const { error } = await supabase
      .from('games')
      .update(validated.data)
      .eq('id', validated.gameId);

    if (error) return { error: '선수 배정 수정에 실패했습니다' };
    return {};
  } catch (e) {
    return actionError(e, '선수 배정 수정에 실패했습니다');
  }
}
