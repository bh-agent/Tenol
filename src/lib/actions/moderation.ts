'use server';

import { createClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

// ============================================================
// 신고/차단 — Apple App Review Guideline 1.2 (UGC) 대응
// ============================================================

const reportSchema = z.object({
  targetType: z.enum(['recruitment_post', 'club', 'user']),
  targetId: z.string().uuid(),
  reason: z.enum(['spam', 'inappropriate', 'harassment', 'fraud', 'other']),
  details: z.string().max(1000).optional(),
});

/**
 * 콘텐츠 또는 사용자 신고
 * Apple 가이드라인 1.2: 부적절한 콘텐츠 신고 메커니즘
 */
export async function reportContent(input: {
  targetType: 'recruitment_post' | 'club' | 'user';
  targetId: string;
  reason: 'spam' | 'inappropriate' | 'harassment' | 'fraud' | 'other';
  details?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const validated = reportSchema.parse(input);

  const { error } = await supabase.from('content_reports').insert({
    reporter_id: user.id,
    target_type: validated.targetType,
    target_id: validated.targetId,
    reason: validated.reason,
    details: validated.details ?? null,
  });

  if (error) {
    logError('moderation', 'Failed to create report', { userId: user.id, error, metadata: { input: validated } });
    throw new Error('신고 접수에 실패했습니다');
  }

  logInfo('moderation', 'Content reported', {
    userId: user.id,
    metadata: { targetType: validated.targetType, targetId: validated.targetId },
  });
}

/**
 * 사용자 차단
 * Apple 가이드라인 1.2: 사용자 차단 메커니즘
 */
export async function blockUser(blockedUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  if (user.id === blockedUserId) {
    throw new Error('본인은 차단할 수 없습니다');
  }

  const { error } = await supabase.from('user_blocks').insert({
    blocker_id: user.id,
    blocked_id: blockedUserId,
  });

  // 이미 차단된 사용자 — 무시
  if (error && !error.message.includes('duplicate')) {
    logError('moderation', 'Failed to block user', { userId: user.id, error, metadata: { blockedUserId } });
    throw new Error('차단에 실패했습니다');
  }

  logInfo('moderation', 'User blocked', { userId: user.id, metadata: { blockedUserId } });
  revalidatePath('/recruit');
  revalidatePath('/clubs/explore');
}

/**
 * 사용자 차단 해제
 */
export async function unblockUser(blockedUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { error } = await supabase
    .from('user_blocks')
    .delete()
    .eq('blocker_id', user.id)
    .eq('blocked_id', blockedUserId);

  if (error) {
    logError('moderation', 'Failed to unblock user', { userId: user.id, error, metadata: { blockedUserId } });
    throw new Error('차단 해제에 실패했습니다');
  }

  logInfo('moderation', 'User unblocked', { userId: user.id, metadata: { blockedUserId } });
  revalidatePath('/recruit');
}

/**
 * 현재 사용자가 차단한 사용자 ID 목록 조회
 * 모집글/탐색 페이지에서 차단한 사용자의 콘텐츠를 필터링하는 데 사용
 */
export async function getBlockedUserIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id);

  return (data ?? []).map((row: { blocked_id: string }) => row.blocked_id);
}
