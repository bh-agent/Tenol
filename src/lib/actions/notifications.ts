'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { uuidSchema } from '@/lib/validations';

export async function markAsRead(notificationId: string) {
  const validId = uuidSchema.parse(notificationId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', validId)
    .eq('user_id', user.id);

  if (error) throw new Error('알림 읽음 처리에 실패했습니다');

  revalidatePath('/notifications');
}

export async function markAllAsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', user.id)
    .eq('is_read', false);

  if (error) throw new Error('알림 읽음 처리에 실패했습니다');

  revalidatePath('/notifications');
}

// createNotification은 서버 전용 모듈로 이동함(액션 엔드포인트 노출 방지):
// @/lib/server/notify

export async function deleteOldNotifications() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { error } = await supabase
    .from('notifications')
    .delete()
    .eq('user_id', user.id)
    .lt('created_at', thirtyDaysAgo.toISOString());

  if (error) throw new Error('오래된 알림 삭제에 실패했습니다');
}
