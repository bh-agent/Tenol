import { createClient } from '@/lib/supabase/server';

/**
 * 사용자의 즐겨찾기 클럽 목록 조회
 */
export async function getBookmarkedClubs() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('club_bookmarks')
    .select(`
      id,
      club_id,
      created_at,
      clubs (
        id, name, description, logo_url, region, main_court, is_public, created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return data?.map((b) => ({ ...b.clubs, bookmark_id: b.id })) || [];
}

/**
 * 특정 클럽이 즐겨찾기되었는지 확인
 */
export async function isClubBookmarked(clubId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data } = await supabase
    .from('club_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('club_id', clubId)
    .maybeSingle();

  return !!data;
}
