'use server';

import { createClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/utils/admin';
import { logError, logInfo } from '@/lib/logger';
import { revalidatePath } from 'next/cache';

export async function banUser(userId: string, reason: string) {
  const adminId = await requireAdmin();
  const supabase = await createClient();

  // 자기 자신은 정지 불가
  if (userId === adminId) {
    throw new Error('자기 자신을 정지할 수 없습니다');
  }

  // 다른 관리자는 정지 불가
  const { data: target } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle();

  if (target?.is_admin) {
    throw new Error('관리자는 정지할 수 없습니다');
  }

  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: true, banned_reason: reason || null })
    .eq('id', userId);

  if (error) {
    logError('system', 'Failed to ban user', { userId, error });
    throw new Error('유저 정지에 실패했습니다');
  }

  logInfo('system', 'User banned', { userId, metadata: { reason, adminId } });
  revalidatePath('/admin/users');
}

export async function unbanUser(userId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ is_banned: false, banned_reason: null })
    .eq('id', userId);

  if (error) {
    logError('system', 'Failed to unban user', { userId, error });
    throw new Error('정지 해제에 실패했습니다');
  }

  logInfo('system', 'User unbanned', { userId });
  revalidatePath('/admin/users');
}

export async function adminDeleteClub(clubId: string) {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from('clubs')
    .delete()
    .eq('id', clubId);

  if (error) {
    logError('system', 'Failed to admin-delete club', { clubId, error });
    throw new Error('클럽 삭제에 실패했습니다');
  }

  logInfo('system', 'Club deleted by admin', { clubId });
  revalidatePath('/admin/clubs');
}
