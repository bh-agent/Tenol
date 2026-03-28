'use server';

import { createClient } from '@/lib/supabase/server';
import type { ClubRole } from '@/types';
import { hasPermission, type Permission } from './permissions';

/**
 * 서버 액션에서 사용하는 권한 검증 헬퍼
 * 유저의 클럽 역할을 조회하고, 해당 권한이 있는지 확인
 */
export async function requirePermission(clubId: string, permission: Permission): Promise<{ userId: string; role: ClubRole }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: membership } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .single();

  const role = (membership?.role as ClubRole) || null;

  if (!hasPermission(role, permission)) {
    throw new Error('권한이 없습니다');
  }

  return { userId: user.id, role: role! };
}

/**
 * match_id로부터 club_id를 조회하고 권한 검증
 */
export async function requireMatchPermission(matchId: string, permission: Permission): Promise<{ userId: string; role: ClubRole; clubId: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: match } = await supabase
    .from('matches')
    .select('club_id')
    .eq('id', matchId)
    .single();

  if (!match) throw new Error('경기를 찾을 수 없습니다');

  const { data: membership } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', match.club_id)
    .eq('user_id', user.id)
    .single();

  const role = (membership?.role as ClubRole) || null;

  if (!hasPermission(role, permission)) {
    throw new Error('권한이 없습니다');
  }

  return { userId: user.id, role: role!, clubId: match.club_id };
}
