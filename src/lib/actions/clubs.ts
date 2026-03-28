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
    .select('id, name')
    .eq('invite_code', validCode)
    .single();

  if (clubError || !club) throw new Error('유효하지 않은 초대 코드입니다');

  // 이미 멤버인지 확인
  const { data: existingMember } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', club.id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMember) throw new Error('이미 가입된 클럽입니다');

  // 이미 신청했는지 확인
  const { data: existingRequest } = await supabase
    .from('club_join_requests')
    .select('id, status')
    .eq('club_id', club.id)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingRequest) throw new Error('이미 가입 신청 중입니다');

  // 이전 거절 기록이 있으면 삭제 후 재신청
  await supabase
    .from('club_join_requests')
    .delete()
    .eq('club_id', club.id)
    .eq('user_id', user.id)
    .neq('status', 'pending');

  const { error } = await supabase.from('club_join_requests').insert({
    club_id: club.id,
    user_id: user.id,
    message: '초대 코드로 가입 신청',
  });

  if (error) {
    if (error.code === '23505') throw new Error('이미 가입 신청 중입니다');
    throw new Error('가입 신청에 실패했습니다');
  }

  // 클럽 관리자에게 알림 전송
  try {
    const { data: admins } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', club.id)
      .in('role', ['owner', 'admin']);

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    const { createNotification } = await import('@/lib/actions/notifications');
    for (const admin of admins || []) {
      await createNotification(
        admin.user_id,
        'join_request',
        '새 가입 신청',
        `${profile?.display_name || '회원'}님이 "${club.name}" 클럽에 가입을 신청했습니다.`,
        { club_id: club.id }
      ).catch(() => {});
    }
  } catch {
    // 알림 실패해도 가입 신청은 성공
  }
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
    .select('id, name, is_public')
    .eq('id', validClubId)
    .eq('is_public', true)
    .single();

  if (!club) throw new Error('공개 클럽이 아니거나 존재하지 않는 클럽입니다');

  // 이미 멤버인지 확인
  const { data: existingMember } = await supabase
    .from('club_members')
    .select('id')
    .eq('club_id', validClubId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existingMember) throw new Error('이미 가입된 클럽입니다');

  // 이미 신청했는지 확인
  const { data: existingRequest } = await supabase
    .from('club_join_requests')
    .select('id, status')
    .eq('club_id', validClubId)
    .eq('user_id', user.id)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingRequest) throw new Error('이미 가입 신청 중입니다');

  // 이전 거절 기록이 있으면 삭제 후 재신청
  await supabase
    .from('club_join_requests')
    .delete()
    .eq('club_id', validClubId)
    .eq('user_id', user.id)
    .neq('status', 'pending');

  const { error } = await supabase.from('club_join_requests').insert({
    club_id: validClubId,
    user_id: user.id,
  });

  if (error) {
    if (error.code === '23505') throw new Error('이미 가입 신청 중입니다');
    throw new Error('가입 신청에 실패했습니다');
  }

  // 클럽 관리자에게 알림 전송
  try {
    const { data: admins } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', validClubId)
      .in('role', ['owner', 'admin']);

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .single();

    const { createNotification } = await import('@/lib/actions/notifications');
    for (const admin of admins || []) {
      await createNotification(
        admin.user_id,
        'join_request',
        '새 가입 신청',
        `${profile?.display_name || '회원'}님이 "${club.name}" 클럽에 가입을 신청했습니다.`,
        { club_id: validClubId }
      ).catch(() => {});
    }
  } catch {
    // 알림 실패해도 가입 신청은 성공
  }
}

// member.manage 권한 필요 - 가입 신청 승인/거절
export async function respondToJoinRequest(requestId: string, approved: boolean) {
  const validRequestId = uuidSchema.parse(requestId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // 신청 정보 조회
  const { data: request } = await supabase
    .from('club_join_requests')
    .select('id, club_id, user_id, status')
    .eq('id', validRequestId)
    .single();

  if (!request) throw new Error('가입 신청을 찾을 수 없습니다');
  if (request.status !== 'pending') throw new Error('이미 처리된 신청입니다');

  // 권한 확인
  await requirePermission(request.club_id, 'member.manage');

  if (approved) {
    // 승인: club_members에 추가
    const { error: memberError } = await supabase.from('club_members').insert({
      club_id: request.club_id,
      user_id: request.user_id,
      role: 'member',
    });

    if (memberError) {
      if (memberError.code === '23505') {
        // 이미 멤버인 경우 신청만 업데이트
      } else {
        throw new Error('멤버 추가에 실패했습니다');
      }
    }
  }

  // 신청 상태 업데이트
  const { error: updateError } = await supabase
    .from('club_join_requests')
    .update({
      status: approved ? 'approved' : 'rejected',
      responded_by: user.id,
      responded_at: new Date().toISOString(),
    })
    .eq('id', validRequestId);

  if (updateError) throw new Error('신청 처리에 실패했습니다');

  // 신청자에게 알림 전송
  try {
    const { data: club } = await supabase
      .from('clubs')
      .select('name')
      .eq('id', request.club_id)
      .single();

    const { createNotification } = await import('@/lib/actions/notifications');
    await createNotification(
      request.user_id,
      approved ? 'join_approved' : 'join_rejected',
      approved ? '가입이 승인되었습니다' : '가입이 거절되었습니다',
      approved
        ? `"${club?.name || '클럽'}" 클럽 가입이 승인되었습니다. 환영합니다!`
        : `"${club?.name || '클럽'}" 클럽 가입이 거절되었습니다.`,
      { club_id: request.club_id }
    );
  } catch {
    // 알림 실패해도 주요 기능은 계속 진행
  }
}

// 사용자가 자신의 가입 신청 취소
export async function cancelJoinRequest(requestId: string) {
  const validRequestId = uuidSchema.parse(requestId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: request } = await supabase
    .from('club_join_requests')
    .select('id, user_id, status')
    .eq('id', validRequestId)
    .single();

  if (!request) throw new Error('가입 신청을 찾을 수 없습니다');
  if (request.user_id !== user.id) throw new Error('권한이 없습니다');
  if (request.status !== 'pending') throw new Error('이미 처리된 신청입니다');

  const { error } = await supabase
    .from('club_join_requests')
    .delete()
    .eq('id', validRequestId);

  if (error) throw new Error('신청 취소에 실패했습니다');
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
