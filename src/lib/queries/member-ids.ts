import { createClient } from '@/lib/supabase/server';

/**
 * 클럽의 현재 회원 user_id 집합.
 * 클럽 통계(랭킹·MVP·클럽 기록)는 회원만 대상으로 한다 — 게스트로 한두 번 참가한
 * 계정이 클럽 랭킹·기록에 섞이지 않도록 player_game_stats 결과를 이 집합으로 거른다.
 */
export async function getClubMemberIds(clubId: string): Promise<Set<string>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from('club_members')
    .select('user_id')
    .eq('club_id', clubId);
  return new Set((data ?? []).map((m) => m.user_id));
}
