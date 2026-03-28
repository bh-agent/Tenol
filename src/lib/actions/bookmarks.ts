'use server';

import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validations';

/**
 * 클럽 즐겨찾기 토글 (추가/제거)
 */
export async function toggleBookmark(clubId: string) {
  const validClubId = uuidSchema.parse(clubId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // 기존 북마크 확인
  const { data: existing } = await supabase
    .from('club_bookmarks')
    .select('id')
    .eq('user_id', user.id)
    .eq('club_id', validClubId)
    .maybeSingle();

  if (existing) {
    // 북마크 제거
    const { error } = await supabase
      .from('club_bookmarks')
      .delete()
      .eq('id', existing.id);

    if (error) throw new Error('즐겨찾기 해제에 실패했습니다');
    return { isBookmarked: false };
  } else {
    // 북마크 추가
    const { error } = await supabase
      .from('club_bookmarks')
      .insert({ user_id: user.id, club_id: validClubId });

    if (error) throw new Error('즐겨찾기 추가에 실패했습니다');
    return { isBookmarked: true };
  }
}
