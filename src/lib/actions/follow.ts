'use server';

import { createClient } from '@/lib/supabase/server';
import { uuidSchema } from '@/lib/validations';
import { createNotification } from './notifications';

/**
 * 팔로우/언팔로우 토글
 */
export async function toggleFollow(targetUserId: string) {
  const validTargetId = uuidSchema.parse(targetUserId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // 자기 자신을 팔로우할 수 없음
  if (user.id === validTargetId) {
    throw new Error('자기 자신을 팔로우할 수 없습니다');
  }

  // 기존 팔로우 확인
  const { data: existing } = await supabase
    .from('follows')
    .select('id')
    .eq('follower_id', user.id)
    .eq('following_id', validTargetId)
    .maybeSingle();

  if (existing) {
    // 언팔로우
    const { error } = await supabase
      .from('follows')
      .delete()
      .eq('id', existing.id);

    if (error) throw new Error('언팔로우에 실패했습니다');
  } else {
    // 팔로우
    const { error } = await supabase
      .from('follows')
      .insert({ follower_id: user.id, following_id: validTargetId });

    if (error) throw new Error('팔로우에 실패했습니다');

    // 팔로우 알림 생성
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', user.id)
        .single();

      const displayName = profile?.display_name ?? '사용자';
      await createNotification(
        validTargetId,
        'new_follower',
        '새 팔로워',
        `${displayName}님이 회원님을 팔로우하기 시작했습니다`,
        { follower_id: user.id }
      );
    } catch {
      // 알림 실패해도 팔로우는 성공 처리
    }
  }

  // 업데이트된 팔로워 카운트 조회
  const { count } = await supabase
    .from('follows')
    .select('*', { count: 'exact', head: true })
    .eq('following_id', validTargetId);

  return { isFollowing: !existing, followerCount: count ?? 0 };
}
