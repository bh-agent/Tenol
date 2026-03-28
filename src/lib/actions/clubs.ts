'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/utils/check-permission';
import { redirect } from 'next/navigation';
import {
  createClubSchema,
  updateClubSchema,
  uuidSchema,
  inviteCodeSchema,
  clubRoleSchema,
} from '@/lib/validations';

export async function createClub(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const validated = createClubSchema.parse({
    name: formData.get('name'),
    description: formData.get('description') || undefined,
    region: formData.get('region') || undefined,
    main_court: formData.get('main_court') || undefined,
    is_public: formData.get('is_public') !== 'false',
  });

  const { data: club, error } = await supabase
    .from('clubs')
    .insert({ ...validated, created_by: user.id })
    .select()
    .single();

  if (error) throw new Error('클럽 생성에 실패했습니다');

  // Auto-join as owner
  await supabase.from('club_members').insert({
    club_id: club.id,
    user_id: user.id,
    role: 'owner',
  });

  redirect(`/clubs/${club.id}?created=true`);
}

export async function joinClubByCode(inviteCode: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const validCode = inviteCodeSchema.parse(inviteCode);

  const { data: club, error: clubError } = await supabase
    .from('clubs')
    .select('id')
    .eq('invite_code', validCode)
    .single();

  if (clubError || !club) throw new Error('유효하지 않은 초대 코드입니다');

  const { error } = await supabase.from('club_members').insert({
    club_id: club.id,
    user_id: user.id,
    role: 'member',
  });

  if (error) {
    if (error.code === '23505') throw new Error('이미 가입된 클럽입니다');
    throw new Error('클럽 가입에 실패했습니다');
  }

  redirect(`/clubs/${club.id}`);
}

// club.edit 권한 필요 (회장만)
export async function updateClub(clubId: string, formData: FormData) {
  const validClubId = uuidSchema.parse(clubId);
  await requirePermission(validClubId, 'club.edit');

  const validated = updateClubSchema.parse({
    name: formData.get('name'),
    description: formData.get('description') as string || null,
    region: formData.get('region') as string || null,
    main_court: formData.get('main_court') as string || null,
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from('clubs')
    .update({
      ...validated,
      updated_at: new Date().toISOString(),
    })
    .eq('id', validClubId);

  if (error) throw new Error('클럽 정보 수정에 실패했습니다');

  redirect(`/clubs/${validClubId}`);
}

// member.manage 권한 필요 (회장, 운영진)
export async function removeMember(clubId: string, targetUserId: string) {
  const validClubId = uuidSchema.parse(clubId);
  const validTargetUserId = uuidSchema.parse(targetUserId);
  const { userId } = await requirePermission(validClubId, 'member.manage');

  if (userId === validTargetUserId) throw new Error('자기 자신은 제명할 수 없습니다');

  const supabase = await createClient();

  // 회장은 제명할 수 없음
  const { data: targetMember } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', validClubId)
    .eq('user_id', validTargetUserId)
    .single();

  if (targetMember?.role === 'owner') throw new Error('클럽장은 제명할 수 없습니다');

  await supabase
    .from('club_members')
    .delete()
    .eq('club_id', validClubId)
    .eq('user_id', validTargetUserId);
}

// member.manage 권한 필요 (회장, 운영진)
export async function updateMemberRole(clubId: string, targetUserId: string, newRole: string) {
  const validClubId = uuidSchema.parse(clubId);
  const validTargetUserId = uuidSchema.parse(targetUserId);
  const validRole = clubRoleSchema.parse(newRole);
  const { role } = await requirePermission(validClubId, 'member.manage');

  // 운영진은 다른 운영진의 역할을 변경할 수 없음
  if (role === 'admin' && validRole === 'admin') {
    throw new Error('운영진 역할 변경은 클럽장만 가능합니다');
  }
  // owner 역할 부여는 owner만 가능
  if (validRole === 'owner') throw new Error('클럽장 역할은 양도할 수 없습니다');

  const supabase = await createClient();
  const { error } = await supabase
    .from('club_members')
    .update({ role: validRole })
    .eq('club_id', validClubId)
    .eq('user_id', validTargetUserId);

  if (error) throw new Error('역할 변경에 실패했습니다');

  // 역할 변경 알림 전송
  const { data: club } = await supabase
    .from('clubs')
    .select('name')
    .eq('id', validClubId)
    .single();

  if (club) {
    const roleLabels: Record<string, string> = { owner: '클럽장', admin: '운영진', member: '멤버' };
    try {
      const { createNotification } = await import('@/lib/actions/notifications');
      await createNotification(
        validTargetUserId,
        'role_changed',
        '역할이 변경되었습니다',
        `"${club.name}" 클럽에서 역할이 ${roleLabels[validRole] || validRole}(으)로 변경되었습니다.`,
        { club_id: validClubId }
      );
    } catch {
      // 알림 전송 실패해도 주요 기능은 계속 진행
    }
  }
}

export async function updateClubLogo(clubId: string, logoUrl: string) {
  const validClubId = uuidSchema.parse(clubId);
  await requirePermission(validClubId, 'club.edit');

  const supabase = await createClient();
  const { error } = await supabase
    .from('clubs')
    .update({ logo_url: logoUrl, updated_at: new Date().toISOString() })
    .eq('id', validClubId);

  if (error) throw new Error('클럽 로고 수정에 실패했습니다');
}

export async function joinPublicClub(clubId: string) {
  const validClubId = uuidSchema.parse(clubId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // 공개 클럽인지 확인
  const { data: club } = await supabase
    .from('clubs')
    .select('id, is_public')
    .eq('id', validClubId)
    .eq('is_public', true)
    .single();

  if (!club) throw new Error('공개 클럽이 아니거나 존재하지 않는 클럽입니다');

  const { error } = await supabase.from('club_members').insert({
    club_id: validClubId,
    user_id: user.id,
    role: 'member',
  });

  if (error) {
    if (error.code === '23505') throw new Error('이미 가입된 클럽입니다');
    throw new Error('클럽 가입에 실패했습니다');
  }

  redirect(`/clubs/${validClubId}`);
}

// club.edit 권한 필요 (회장만) - 클럽 삭제
export async function deleteClub(clubId: string) {
  const validClubId = uuidSchema.parse(clubId);
  await requirePermission(validClubId, 'club.edit');

  const supabase = await createClient();

  // 회장만 삭제 가능하므로 추가 검증
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: membership } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', validClubId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'owner') {
    throw new Error('클럽장만 클럽을 삭제할 수 있습니다');
  }

  const { error } = await supabase
    .from('clubs')
    .delete()
    .eq('id', validClubId);

  if (error) throw new Error('클럽 삭제에 실패했습니다');

  redirect('/clubs');
}

export async function leaveClub(clubId: string) {
  const validClubId = uuidSchema.parse(clubId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // 회장은 탈퇴 불가
  const { data: membership } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', validClubId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role === 'owner') throw new Error('클럽장은 클럽을 탈퇴할 수 없습니다');

  await supabase
    .from('club_members')
    .delete()
    .eq('club_id', validClubId)
    .eq('user_id', user.id);

  redirect('/clubs');
}
