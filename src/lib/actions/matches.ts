'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission, requireMatchPermission } from '@/lib/utils/check-permission';
import { redirect } from 'next/navigation';
import {
  createMatchSchema,
  updateMatchSchema,
  uuidSchema,
  guestApplySchema,
  offlineParticipantSchema,
  matchStatusSchema,
} from '@/lib/validations';

// match.create 권한 필요 (회장, 운영진, 멤버)
export async function createMatch(formData: FormData) {
  const clubId = formData.get('club_id') as string;
  const { userId } = await requirePermission(clubId, 'match.create');

  const supabase = await createClient();

  const validated = createMatchSchema.parse({
    club_id: clubId,
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    location: formData.get('location') || undefined,
    match_date: formData.get('match_date'),
    start_time: formData.get('start_time') || undefined,
    end_time: formData.get('end_time') || undefined,
    court_count: Number(formData.get('court_count')) || 1,
    max_participants: formData.get('max_participants') ? Number(formData.get('max_participants')) : undefined,
    allow_guests: formData.get('allow_guests') !== 'false',
    format: (formData.get('format') as string) || 'doubles',
  });

  const { data: match, error } = await supabase
    .from('matches')
    .insert({ ...validated, created_by: userId })
    .select()
    .single();

  if (error) throw new Error('경기 생성에 실패했습니다');

  // Auto-add creator as participant
  await supabase.from('match_participants').insert({
    match_id: match.id,
    user_id: userId,
    participant_type: 'member',
    status: 'confirmed',
  });

  redirect(`/clubs/${validated.club_id}/matches/${match.id}`);
}

export async function joinMatch(matchId: string) {
  const validMatchId = uuidSchema.parse(matchId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { error } = await supabase.rpc('join_match_atomically', {
    p_match_id: validMatchId,
    p_user_id: user.id,
    p_participant_type: 'member',
    p_status: 'confirmed',
  });

  if (error) {
    if (error.message?.includes('MATCH_FULL')) throw new Error('참가 인원이 가득 찼습니다');
    if (error.code === '23505') throw new Error('이미 참가 신청했습니다');
    throw new Error('참가 신청에 실패했습니다');
  }
}

export async function applyAsGuest(matchId: string, name: string, phone?: string) {
  const validMatchId = uuidSchema.parse(matchId);
  const validated = guestApplySchema.parse({ name, phone });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { error } = await supabase.rpc('join_match_atomically', {
    p_match_id: validMatchId,
    p_user_id: user.id,
    p_participant_type: 'guest',
    p_status: 'pending',
    p_guest_name: validated.name,
    p_guest_phone: validated.phone || null,
  });

  if (error) {
    if (error.message?.includes('MATCH_FULL')) throw new Error('참가 인원이 가득 찼습니다');
    if (error.code === '23505') throw new Error('이미 참가 신청했습니다');
    throw new Error('게스트 신청에 실패했습니다');
  }
}

// member.manage 권한 필요 (회장, 운영진)
export async function respondToGuest(participantId: string, matchId: string, approved: boolean) {
  const validParticipantId = uuidSchema.parse(participantId);
  const validMatchId = uuidSchema.parse(matchId);
  await requireMatchPermission(validMatchId, 'member.manage');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // 참가자 정보 조회 (알림 전송용)
  const { data: participant } = await supabase
    .from('match_participants')
    .select('user_id, guest_name')
    .eq('id', validParticipantId)
    .single();

  const { error } = await supabase
    .from('match_participants')
    .update({
      status: approved ? 'confirmed' : 'rejected',
      responded_at: new Date().toISOString(),
      responded_by: user.id,
    })
    .eq('id', validParticipantId);

  if (error) throw new Error('처리에 실패했습니다');

  // 게스트 승인/거절 알림 전송
  if (participant?.user_id) {
    const { data: match } = await supabase
      .from('matches')
      .select('title, club_id')
      .eq('id', validMatchId)
      .single();

    if (match) {
      try {
        const { createNotification } = await import('@/lib/actions/notifications');
        await createNotification(
          participant.user_id,
          approved ? 'guest_approved' : 'guest_rejected',
          approved ? '게스트 참가 승인' : '게스트 참가 거절',
          approved
            ? `"${match.title}" 경기에 게스트로 참가가 승인되었습니다.`
            : `"${match.title}" 경기의 게스트 참가가 거절되었습니다.`,
          { match_id: validMatchId, club_id: match.club_id }
        );
      } catch {
        // 알림 전송 실패해도 주요 기능은 계속 진행
      }
    }
  }
}

export async function withdrawFromMatch(matchId: string) {
  const validMatchId = uuidSchema.parse(matchId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  await supabase
    .from('match_participants')
    .delete()
    .eq('match_id', validMatchId)
    .eq('user_id', user.id);
}

/**
 * 비회원(앱 미가입자) 참가자 직접 추가
 */
export async function addOfflineParticipant(matchId: string, name: string, gender: 'M' | 'F', ntrpLevel?: number) {
  const validMatchId = uuidSchema.parse(matchId);
  const validated = offlineParticipantSchema.parse({ name, gender, ntrpLevel });
  await requireMatchPermission(validMatchId, 'match.create');

  const supabase = await createClient();

  // 비회원은 user_id가 null이므로 RPC 대신 직접 insert
  // (RPC 함수의 p_user_id가 UUID 타입이라 null 전달 불가)
  // 먼저 capacity 체크
  const { data: match } = await supabase
    .from('matches')
    .select('max_participants')
    .eq('id', validMatchId)
    .single();

  if (match?.max_participants) {
    const { count } = await supabase
      .from('match_participants')
      .select('*', { count: 'exact', head: true })
      .eq('match_id', validMatchId)
      .in('status', ['confirmed', 'pending']);

    if ((count ?? 0) >= match.max_participants) {
      throw new Error('참가 인원이 가득 찼습니다');
    }
  }

  const { error } = await supabase.from('match_participants').insert({
    match_id: validMatchId,
    user_id: null,
    guest_name: validated.name,
    guest_gender: validated.gender,
    participant_type: 'guest',
    status: 'confirmed',
    ntrp_override: validated.ntrpLevel || null,
  });

  if (error) {
    throw new Error('참가자 추가에 실패했습니다');
  }
}

/**
 * 참가자 삭제 (비회원 또는 본인)
 */
export async function removeParticipant(participantId: string, matchId: string) {
  const validParticipantId = uuidSchema.parse(participantId);
  const validMatchId = uuidSchema.parse(matchId);
  await requireMatchPermission(validMatchId, 'match.create');

  const supabase = await createClient();
  const { error } = await supabase
    .from('match_participants')
    .delete()
    .eq('id', validParticipantId);

  if (error) throw new Error('참가자 삭제에 실패했습니다');
}

export async function updateMatch(matchId: string, formData: FormData) {
  const validMatchId = uuidSchema.parse(matchId);
  const { clubId } = await requireMatchPermission(validMatchId, 'match.create');

  const validated = updateMatchSchema.parse({
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    location: formData.get('location') || undefined,
    match_date: formData.get('match_date'),
    start_time: formData.get('start_time') || undefined,
    end_time: formData.get('end_time') || undefined,
    court_count: Number(formData.get('court_count')) || 1,
    max_participants: formData.get('max_participants') ? Number(formData.get('max_participants')) : undefined,
    format: (formData.get('format') as string) || 'doubles',
  });

  const supabase = await createClient();
  const { error } = await supabase
    .from('matches')
    .update({ ...validated, updated_at: new Date().toISOString() })
    .eq('id', validMatchId);

  if (error) throw new Error('경기 수정에 실패했습니다');

  redirect(`/clubs/${clubId}/matches/${validMatchId}`);
}

export async function deleteMatch(matchId: string) {
  const validMatchId = uuidSchema.parse(matchId);
  const { clubId } = await requireMatchPermission(validMatchId, 'match.create');

  const supabase = await createClient();

  // Check match status - only upcoming or cancelled can be deleted
  const { data: match } = await supabase
    .from('matches')
    .select('status')
    .eq('id', validMatchId)
    .single();

  if (!match) throw new Error('경기를 찾을 수 없습니다');
  if (match.status !== 'upcoming' && match.status !== 'cancelled') {
    throw new Error('진행 중이거나 완료된 경기는 삭제할 수 없습니다');
  }

  const { error } = await supabase
    .from('matches')
    .delete()
    .eq('id', validMatchId);

  if (error) throw new Error('경기 삭제에 실패했습니다');

  redirect(`/clubs/${clubId}`);
}

export async function updateMatchStatus(matchId: string, status: string) {
  const validMatchId = uuidSchema.parse(matchId);
  const validStatus = matchStatusSchema.parse(status);
  await requireMatchPermission(validMatchId, 'match.create');

  const supabase = await createClient();
  const { error } = await supabase
    .from('matches')
    .update({ status: validStatus, updated_at: new Date().toISOString() })
    .eq('id', validMatchId);

  if (error) throw new Error('상태 변경에 실패했습니다');
}
