import { createClient } from '@/lib/supabase/server';
import { generateDraw, generateDrawNew, generateDrawV2 } from '@/lib/draw-engine';
import type { DrawType as EngineDrawType, DrawMode } from '@/lib/draw-engine';
import { createNotification } from '@/lib/actions/notifications';
import { requireMatchPermission } from '@/lib/utils/check-permission';
import { generateDrawSchema } from '@/lib/validations';
import { NextResponse } from 'next/server';
import { DRAW_MODES } from '@/lib/constants';

const V1_DRAW_TYPES: Set<string> = new Set(['mixed_doubles', 'mens_doubles', 'womens_doubles', 'free']);
const V2_DRAW_MODES: Set<string> = new Set(DRAW_MODES.map(m => m.value));

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

    // Normalize profiles from Supabase join (may be array)
    const normalizedParticipants = ((match.match_participants as any[]) || []).map((p: any) => ({
      ...p,
      profiles: Array.isArray(p.profiles) ? p.profiles[0] || null : p.profiles,
    }));
    (match as any).match_participants = normalizedParticipants;

    const isV2Mode = V2_DRAW_MODES.has(validated.drawType as string);
    const isV1DrawType = V1_DRAW_TYPES.has(validated.drawType as string);

    let v2Result: ReturnType<typeof generateDrawV2> | null = null;
    let v1Games: any[] = [];
    let sitOuts: any[] = [];
    let timeSlots: any[] = [];
    let teams: any[] = [];

    if (isV2Mode) {
      // V2 draw engine
      const courtNames = validated.courtNames || [];
      const courts = Array.from({ length: match.court_count }, (_, i) => ({
        name: courtNames[i] || `${i + 1}코트`,
      }));

      const defaultGamesPerCourt = validated.gamesPerCourt || 5;

      v2Result = generateDrawV2({
        participants: match.match_participants as any,
        courts,
        gamesPerCourt: defaultGamesPerCourt,
        mode: validated.drawType as DrawMode,
        startTime: validated.startTime || '08:00',
        timeSlotMinutes: validated.timeSlotMinutes || 30,
      });

      sitOuts = v2Result.sitOuts;
    } else if (isV1DrawType) {
      // V1 new draw engine
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

      v1Games = result.games;
      sitOuts = result.sitOuts;
      timeSlots = result.timeSlots;
      teams = result.teams;
    } else {
      // Legacy draw engine
      v1Games = generateDraw(
        {
          participants: match.match_participants as any,
          courtCount: match.court_count,
          format: match.format as any,
        },
        validated.drawType as any,
      );
    }

    // For V2, always round_number = 1
    const roundNumber = isV2Mode ? 1 : validated.roundNumber;

    // Delete existing draw for this round if exists
    await supabase
      .from('draws')
      .delete()
      .eq('match_id', validated.matchId)
      .eq('round_number', roundNumber);

    // Create draw record
    const { data: draw, error: drawError } = await supabase
      .from('draws')
      .insert({
        match_id: validated.matchId,
        round_number: roundNumber,
        draw_type: validated.drawType,
        created_by: userId,
      })
      .select()
      .single();

    if (drawError) {
      return NextResponse.json({ error: '대진표 생성에 실패했습니다' }, { status: 500 });
    }

    // Create game records
    let gameInserts: any[];

    if (v2Result) {
      // Map V2 GameSlot[] to DB format
      gameInserts = v2Result.games.map((g) => ({
        draw_id: draw.id,
        court_number: g.courtIndex,
        game_order: g.timeSlotIndex,
        team_a_player1_id: g.teamA.player1.id,
        team_a_player2_id: g.teamA.player2.id,
        team_b_player1_id: g.teamB.player1.id,
        team_b_player2_id: g.teamB.player2.id,
      }));
    } else {
      gameInserts = v1Games.map((g) => ({
        draw_id: draw.id,
        court_number: g.court_number,
        game_order: g.game_order,
        team_a_player1_id: g.teamA.player1.id,
        team_a_player2_id: g.teamA.player2?.id || null,
        team_b_player1_id: g.teamB.player1.id,
        team_b_player2_id: g.teamB.player2?.id || null,
      }));
    }

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
            `"${matchTitle}" 경기의 대진표가 생성되었습니다.`,
            { match_id: validated.matchId, club_id: match.club_id }
          );
        } catch {
          // 알림 실패는 무시
        }
      }
    }

    const gameCount = v2Result ? v2Result.games.length : v1Games.length;
    const sitOutCount = v2Result
      ? v2Result.sitOuts.reduce((sum, s) => sum + s.players.length, 0)
      : sitOuts.length;

    return NextResponse.json({
      success: true,
      drawId: draw.id,
      gameCount,
      sitOutCount,
      teamCount: teams.length,
      timeSlots: v2Result ? v2Result.totalTimeSlots : (timeSlots.length > 0 ? timeSlots : undefined),
      playerSummary: v2Result ? v2Result.playerSummary : undefined,
    });
  } catch (error) {
    console.error('[draw/generate] Error:', error);
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json({ error: '잘못된 요청 데이터입니다', details: (error as any).issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : '오류가 발생했습니다';
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json({ error: message, stack: process.env.NODE_ENV === 'development' ? stack : undefined }, { status: 400 });
  }
}
