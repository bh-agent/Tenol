import { createClient } from '@/lib/supabase/server';

export async function getClubMatches(clubId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('matches')
    .select(`
      *,
      match_participants (id, user_id, status)
    `)
    .eq('club_id', clubId)
    .order('match_date', { ascending: false });

  return data || [];
}

export async function getMatch(matchId: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      match_participants (
        id, user_id, guest_name, participant_type, status, ntrp_override, introduction, requested_at,
        profiles:user_id (id, display_name, avatar_url, ntrp_level, gender, tennis_start_date, bio, real_name)
      )
    `)
    .eq('id', matchId)
    .maybeSingle();

  if (error) {
    // If columns don't exist yet (migration not applied), retry with minimal select
    const { data: fallback } = await supabase
      .from('matches')
      .select(`
        *,
        match_participants (
          id, user_id, guest_name, participant_type, status, ntrp_override, requested_at,
          profiles:user_id (id, display_name, avatar_url, ntrp_level, gender, tennis_start_date)
        )
      `)
      .eq('id', matchId)
      .maybeSingle();
    return fallback;
  }

  return data;
}

export async function getMyMatches() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('match_participants')
    .select(`
      id, status, participant_type,
      matches:match_id (
        id, club_id, title, match_date, start_time, location, status, format, court_count,
        clubs:club_id (id, name)
      )
    `)
    .eq('user_id', user.id)
    // confirmed만 보여주면 대기자·게스트 승인대기인 사람은 '내 경기'가 비어 보인다
    // → 자기 신청 상태를 확인할 수 있도록 waitlisted/pending도 포함 (UI에서 배지로 구분)
    .in('status', ['confirmed', 'waitlisted', 'pending'])
    .order('requested_at', { ascending: false });

  // 에러를 삼키고 []를 반환하면 "경기 없음"으로 위장되어 장애가 보이지 않는다.
  // (실사례: enum에 waitlisted가 없던 DB에서 쿼리 전체가 터졌는데 빈 탭으로만 보임)
  if (error) {
    const { logError } = await import('@/lib/logger');
    logError('match', 'getMyMatches 조회 실패', {
      userId: user.id,
      metadata: { code: error.code, message: error.message },
    });
    throw new Error('내 경기를 불러오지 못했습니다'); // error.tsx가 재시도 UI 표시
  }

  return data || [];
}

export async function getMatchDraws(matchId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('draws')
    .select(`
      *,
      games (
        *
      )
    `)
    .eq('match_id', matchId)
    .order('round_number');

  return data || [];
}

export async function getPendingGuestCount(clubId: string): Promise<number> {
  const supabase = await createClient();

  const { count } = await supabase
    .from('match_participants')
    .select('id, matches!inner(club_id)', { count: 'exact', head: true })
    .eq('matches.club_id', clubId)
    .eq('status', 'pending')
    .or('user_id.not.is.null,guest_name.not.is.null');

  return count || 0;
}

export async function getPendingGuestCountByMatch(clubId: string): Promise<Record<string, number>> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('match_participants')
    .select('match_id, matches!inner(club_id)')
    .eq('matches.club_id', clubId)
    .eq('status', 'pending')
    .or('user_id.not.is.null,guest_name.not.is.null');

  const counts: Record<string, number> = {};
  for (const row of data || []) {
    counts[row.match_id] = (counts[row.match_id] || 0) + 1;
  }
  return counts;
}

export async function getMyGamesInMatch(matchId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // First get user's participant ID for this match
  const { data: participant } = await supabase
    .from('match_participants')
    .select('id')
    .eq('match_id', matchId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!participant) return [];

  const pid = participant.id;

  const { data } = await supabase
    .from('games')
    .select(`
      *,
      draws:draw_id (round_number, draw_type)
    `)
    .or(`team_a_player1_id.eq.${pid},team_a_player2_id.eq.${pid},team_b_player1_id.eq.${pid},team_b_player2_id.eq.${pid}`)
    .order('court_number')
    .order('game_order');

  return data || [];
}
