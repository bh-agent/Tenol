'use server';

import { createClient } from '@/lib/supabase/server';

const LOCK_EXPIRY_MINUTES = 5;

export type DrawLockResult =
  | { locked: false }
  | { locked: true; lockedBy: string; lockedAt: string };

/**
 * Try to acquire the draw edit lock for a match.
 * - If no lock exists or lock is expired (>5 min) or lock is owned by current user: upsert and return { locked: false }
 * - If lock is held by another user and not expired: return { locked: true, lockedBy, lockedAt }
 */
export async function acquireDrawLock(matchId: string): Promise<DrawLockResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // Get user display name for the lock
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, real_name')
    .eq('id', user.id)
    .maybeSingle();

  const displayName = profile?.real_name || profile?.display_name || '관리자';

  // Check existing lock
  const { data: existingLock } = await supabase
    .from('draw_edit_locks')
    .select('locked_by, locked_at, display_name')
    .eq('match_id', matchId)
    .maybeSingle();

  if (existingLock) {
    const lockedAt = new Date(existingLock.locked_at);
    const now = new Date();
    const minutesElapsed = (now.getTime() - lockedAt.getTime()) / (1000 * 60);

    // If locked by someone else and not expired
    if (existingLock.locked_by !== user.id && minutesElapsed < LOCK_EXPIRY_MINUTES) {
      return {
        locked: true,
        lockedBy: existingLock.display_name || '다른 관리자',
        lockedAt: existingLock.locked_at,
      };
    }
  }

  // Upsert: take or refresh the lock
  const { error } = await supabase
    .from('draw_edit_locks')
    .upsert(
      {
        match_id: matchId,
        locked_by: user.id,
        locked_at: new Date().toISOString(),
        display_name: displayName,
      },
      { onConflict: 'match_id' }
    );

  if (error) {
    console.error('Failed to acquire draw lock:', error);
    // Don't block the user if lock acquisition fails
    return { locked: false };
  }

  return { locked: false };
}

/**
 * Release the draw edit lock (only if owned by current user).
 */
export async function releaseDrawLock(matchId: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from('draw_edit_locks')
    .delete()
    .eq('match_id', matchId)
    .eq('locked_by', user.id);
}

/**
 * Check current lock status without acquiring.
 */
export async function checkDrawLock(matchId: string): Promise<DrawLockResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: existingLock } = await supabase
    .from('draw_edit_locks')
    .select('locked_by, locked_at, display_name')
    .eq('match_id', matchId)
    .maybeSingle();

  if (!existingLock) return { locked: false };

  const lockedAt = new Date(existingLock.locked_at);
  const now = new Date();
  const minutesElapsed = (now.getTime() - lockedAt.getTime()) / (1000 * 60);

  // Expired lock
  if (minutesElapsed >= LOCK_EXPIRY_MINUTES) return { locked: false };

  // Own lock
  if (existingLock.locked_by === user.id) return { locked: false };

  return {
    locked: true,
    lockedBy: existingLock.display_name || '다른 관리자',
    lockedAt: existingLock.locked_at,
  };
}
