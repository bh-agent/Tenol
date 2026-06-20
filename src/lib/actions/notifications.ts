'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import { uuidSchema } from '@/lib/validations';
import type { NotificationType } from '@/types';

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

export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data: Record<string, string> = {}
) {
  const validUserId = uuidSchema.parse(userId);
  const sanitizedTitle = title.replace(/<[^>]*>/g, '').slice(0, 200);
  const sanitizedBody = body.replace(/<[^>]*>/g, '').slice(0, 1000);

  // notifications INSERT는 RLS로 직접 삽입이 막혀 있으므로(타 사용자 위조 알림 방지)
  // service_role로 삽입한다. createNotification은 항상 서버 액션 내부에서
  // 호출자가 권한 검사를 끝낸 뒤에만 불리므로 안전하다.
  // service_role 키가 없으면 사용자 클라이언트로 폴백(개발 환경 등).
  const supabase = createServiceRoleClient() ?? (await createClient());

  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: validUserId,
      type,
      title: sanitizedTitle,
      body: sanitizedBody,
      data,
    });

  if (error) throw new Error('알림 생성에 실패했습니다');

  // 인앱 알림 저장 후 푸시도 시도 (FCM 미설정 시 자동 no-op, 실패해도 무시)
  try {
    const { sendPushToUser } = await import('@/lib/actions/push');
    await sendPushToUser(validUserId, { title: sanitizedTitle, body: sanitizedBody, data });
  } catch {
    // 푸시 실패는 인앱 알림에 영향 없음
  }
}

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
