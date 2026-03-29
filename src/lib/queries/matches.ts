import { createClient } from '@/lib/supabase/server';

export async function getClubMatches(clubId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('matches')
    .select(`
      *,
      match_participants (id, status)
    `)
    .eq('club_id', clubId)
    .order('match_date', { ascending: false });

  return data || [];
}

export async function getMatch(matchId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('matches')
    .select(`
      *,
      match_participants (
        id, user_id, guest_name, participant_type, status, ntrp_override, introduction,
        profiles:user_id (id, display_name, avatar_url, ntrp_level, gender, tennis_start_date)
      )
    `)
    .eq('id', matchId)
    .single();

  return data;
}

export async function getMyMatches() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('match_participants')
    .select(`
      id, status, participant_type,
      matches:match_id (
        id, club_id, title, match_date, start_time, location, status, format, court_count,
        clubs:club_id (id, name)
      )
    `)
    .eq('user_id', user.id)
    .eq('status', 'confirmed')
    .order('requested_at', { ascending: false });

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
    .single();

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
