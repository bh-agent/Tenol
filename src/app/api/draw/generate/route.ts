import { createClient } from '@/lib/supabase/server';
import { generateDraw, generateDrawNew } from '@/lib/draw-engine';
import type { DrawType as EngineDrawType } from '@/lib/draw-engine';
import { createNotification } from '@/lib/actions/notifications';
import { requireMatchPermission } from '@/lib/utils/check-permission';
import { generateDrawSchema } from '@/lib/validations';
import { NextResponse } from 'next/server';

const NEW_DRAW_TYPES = new Set(['mixed_doubles', 'mens_doubles', 'womens_doubles', 'free']);

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const body = await request.json();
    const validated = generateDrawSchema.parse(body);

    // draw.manage 권한 검증 (회장, 운영진, 멤버)
    const { userId } = await requireMatchPermission(validated.matchId, 'draw.manage');

    // Get match with participants
    const { data: match } = await supabase
      .from('matches')
      .select(`
        id, title, court_count, format, created_by, club_id,
        match_participants (
          id, user_id, guest_name, guest_gender, participant_type, status, ntrp_override,
          profiles:user_id (id, display_name, avatar_url, ntrp_level, gender)
        )
      `)
      .eq('id', validated.matchId)
      .single();

    if (!match) {
      return NextResponse.json({ error: '경기를 찾을 수 없습니다' }, { status: 404 });
    }

    const isNewDrawType = NEW_DRAW_TYPES.has(validated.drawType);

    let games;
    let sitOuts: any[] = [];
    let timeSlots: any[] = [];
    let teams: any[] = [];

    if (isNewDrawType) {
      // New draw engine
      const teamCount = Math.floor(
        (match.match_participants as any[]).filter((p: any) => p.status === 'confirmed').length / 2
      );
      const totalGames = (teamCount * (teamCount - 1)) / 2;
      const defaultGamesPerCourt = Math.max(1, Math.ceil(totalGames / match.court_count));

      const result = generateDrawNew({
        participants: match.match_participants as any,
        courtCount: match.court_count,
        gamesPerCourt: validated.gamesPerCourt || defaultGamesPerCourt,
        drawType: validated.drawType as EngineDrawType,
        timeSlotMinutes: validated.timeSlotMinutes,
        startTime: validated.startTime,
        courtNames: validated.courtNames,
      });

      games = result.games;
      sitOuts = result.sitOuts;
      timeSlots = result.timeSlots;
      teams = result.teams;
    } else {
      // Legacy draw engine
      games = generateDraw(
        {
          participants: match.match_participants as any,
          courtCount: match.court_count,
          format: match.format as any,
        },
        validated.drawType as any,
      );
    }

    // Delete existing draw for this round if exists
    await supabase
      .from('draws')
      .delete()
      .eq('match_id', validated.matchId)
      .eq('round_number', validated.roundNumber);

    // Create draw record
    const { data: draw, error: drawError } = await supabase
      .from('draws')
      .insert({
        match_id: validated.matchId,
        round_number: validated.roundNumber,
        draw_type: validated.drawType,
        created_by: userId,
      })
      .select()
      .single();

    if (drawError) {
      return NextResponse.json({ error: '대진표 생성에 실패했습니다' }, { status: 500 });
    }

    // Create game records
    const gameInserts = games.map((g) => ({
      draw_id: draw.id,
      court_number: g.court_number,
      game_order: g.game_order,
      team_a_player1_id: g.teamA.player1.id,
      team_a_player2_id: g.teamA.player2?.id || null,
      team_b_player1_id: g.teamB.player1.id,
      team_b_player2_id: g.teamB.player2?.id || null,
    }));

    const { error: gamesError } = await supabase
      .from('games')
      .insert(gameInserts);

    if (gamesError) {
      return NextResponse.json({ error: '게임 생성에 실패했습니다' }, { status: 500 });
    }

    // 대진표 생성 알림 전송 (참가자들에게)
    const matchTitle = (match as any).title || '경기';
    const participants = (match.match_participants as any[]) || [];
    for (const p of participants) {
      if (p.user_id && p.user_id !== userId && p.status === 'confirmed') {
        try {
          await createNotification(
            p.user_id,
            'draw_published',
            '대진표가 발표되었습니다',
            `"${matchTitle}" 경기의 ${validated.roundNumber}라운드 대진표가 생성되었습니다.`,
            { match_id: validated.matchId, club_id: match.club_id }
          );
        } catch {
          // 알림 실패는 무시
        }
      }
    }

    return NextResponse.json({
      success: true,
      drawId: draw.id,
      gameCount: games.length,
      sitOutCount: sitOuts.length,
      teamCount: teams.length,
      timeSlots: timeSlots.length > 0 ? timeSlots : undefined,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: '잘못된 요청 데이터입니다' }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : '오류가 발생했습니다';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
