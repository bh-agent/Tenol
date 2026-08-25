'use server';

import { createClient } from '@/lib/supabase/server';
import type { ClubRole } from '@/types';
import { hasPermission, type Permission, type ClubPermission } from './permissions';

/**
 * 커스텀 권한이 있으면 커스텀 권한을, 없으면 역할 기본 권한을 확인
 */
function checkMemberPermission(
  role: ClubRole | null,
  permission: Permission,
  customPermissions: string[] | null
): boolean {
  // owner는 항상 모든 권한 보유
  if (role === 'owner') return true;
  // 커스텀 권한이 설정되어 있으면 커스텀 기준으로 확인
  if (customPermissions !== null && customPermissions !== undefined) {
    return customPermissions.includes(permission);
  }
  // 커스텀 없으면 역할 기본 권한
  return hasPermission(role, permission);
}

/**
 * 서버 액션에서 사용하는 권한 검증 헬퍼
 * 유저의 클럽 역할을 조회하고, 해당 권한이 있는지 확인
 */
export async function requirePermission(clubId: string, permission: Permission): Promise<{ userId: string; role: ClubRole }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // custom_permissions 컬럼이 아직 없을 수 있으므로 에러 시 fallback
  let membership: any = null;
  const { data: m1, error: e1 } = await supabase
    .from('club_members')
    .select('role, custom_permissions')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!e1) {
    membership = m1;
  } else {
    const { data: m2 } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', clubId)
      .eq('user_id', user.id)
      .maybeSingle();
    membership = m2;
  }

  const role = (membership?.role as ClubRole) || null;
  const customPermissions = (membership?.custom_permissions as string[] | null) ?? null;

  if (!checkMemberPermission(role, permission, customPermissions)) {
    throw new Error('권한이 없습니다');
  }

  return { userId: user.id, role: role! };
}

/**
 * 대진 편집(개별 게임 수정·선수 교체) 권한 검증.
 * draw.manage 권한이 있어야 하고, 매치가 종료(completed/cancelled)된 경우에는
 * 회장(owner)·운영진(admin)만 편집할 수 있다. (일반 회원은 종료 대진 편집 불가)
 */
export async function requireMatchDrawEdit(matchId: string): Promise<{ userId: string; role: ClubRole; clubId: string }> {
  const ctx = await requireMatchPermission(matchId, 'draw.manage');
  const supabase = await createClient();
  const { data: match } = await supabase
    .from('matches')
    .select('status')
    .eq('id', matchId)
    .maybeSingle();
  const ended = match?.status === 'completed' || match?.status === 'cancelled';
  if (ended && ctx.role !== 'owner' && ctx.role !== 'admin') {
    throw new Error('종료된 대진은 회장·운영진만 수정할 수 있습니다');
  }
  return ctx;
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
    .maybeSingle();

  if (!match) throw new Error('경기를 찾을 수 없습니다');

  let membership: any = null;
  const { data: m1, error: e1 } = await supabase
    .from('club_members')
    .select('role, custom_permissions')
    .eq('club_id', match.club_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!e1) {
    membership = m1;
  } else {
    const { data: m2 } = await supabase
      .from('club_members')
      .select('role')
      .eq('club_id', match.club_id)
      .eq('user_id', user.id)
      .maybeSingle();
    membership = m2;
  }

  const role = (membership?.role as ClubRole) || null;
  const customPermissions = (membership?.custom_permissions as string[] | null) ?? null;

  if (!checkMemberPermission(role, permission, customPermissions)) {
    throw new Error('권한이 없습니다');
  }

  return { userId: user.id, role: role!, clubId: match.club_id };
}
