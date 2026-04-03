'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission, requireMatchPermission } from '@/lib/utils/check-permission';
import { logError, logInfo, logWarn } from '@/lib/logger';
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

  // Parse participants JSON if provided
  const participantsRaw = formData.get('participants') as string | null;
  let participants: { members?: string[]; offline?: { name: string; gender: 'M' | 'F'; ntrp?: number }[] } | undefined;
  if (participantsRaw) {
    try {
      participants = JSON.parse(participantsRaw);
    } catch (e) {
      logWarn('match', 'Invalid participants JSON in createMatch', { userId, error: e });
    }
  }

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
    participants,
  });

  const { participants: validatedParticipants, ...matchData } = validated;

  const { data: match, error } = await supabase
    .from('matches')
    .insert({ ...matchData, created_by: userId })
    .select()
    .single();

  if (error) {
    logError('match', 'Failed to create match', { userId, clubId, error });
    throw new Error('경기 생성에 실패했습니다');
  }

  logInfo('match', 'Match created', { userId, matchId: match.id, clubId });

  // Auto-add creator as participant
  await supabase.from('match_participants').insert({
    match_id: match.id,
    user_id: userId,
    participant_type: 'member',
    status: 'confirmed',
  });

  // Add pre-selected participants
  if (validatedParticipants) {
    const inserts: Array<Record<string, unknown>> = [];

    // Add selected club members (skip creator)
    if (validatedParticipants.members) {
      for (const memberId of validatedParticipants.members) {
        if (memberId === userId) continue;
        inserts.push({
          match_id: match.id,
          user_id: memberId,
          participant_type: 'member',
          status: 'confirmed',
        });
      }
    }

    // Add offline participants
    if (validatedParticipants.offline) {
      for (const p of validatedParticipants.offline) {
        inserts.push({
          match_id: match.id,
          user_id: null,
          guest_name: p.name,
          guest_gender: p.gender,
          participant_type: 'guest',
          status: 'confirmed',
          ntrp_override: p.ntrp || null,
        });
      }
    }

    if (inserts.length > 0) {
      await supabase.from('match_participants').insert(inserts);
    }
  }

  redirect(`/clubs/${matchData.club_id}/matches/${match.id}`);
}

export async function joinMatch(matchId: string) {
  const validMatchId = uuidSchema.parse(matchId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // The RPC now auto-assigns 'waitlisted' status when match is full
  const { error } = await supabase.rpc('join_match_atomically', {
    p_match_id: validMatchId,
    p_user_id: user.id,
    p_participant_type: 'member',
    p_status: 'confirmed',
  });

  if (error) {
    if (error.message?.includes('MATCH_NOT_FOUND')) throw new Error('경기를 찾을 수 없습니다');
    if (error.message?.includes('REGISTRATION_CLOSED')) throw new Error('모집이 마감되었습니다');
    if (error.code === '23505') throw new Error('이미 참가 신청했습니다');

    // RPC might be outdated - fallback to direct insert with safety checks
    const { data: matchCheck } = await supabase
      .from('matches')
      .select('status, registration_closed, max_participants')
      .eq('id', validMatchId)
      .maybeSingle();

    if (!matchCheck) throw new Error('경기를 찾을 수 없습니다');
    if (matchCheck.status === 'completed' || matchCheck.status === 'cancelled') {
      throw new Error('종료되었거나 취소된 경기에는 참가할 수 없습니다');
    }
    if (matchCheck.registration_closed) throw new Error('모집이 마감되었습니다');

    // Determine status: waitlisted if full, confirmed otherwise
    let status: 'confirmed' | 'waitlisted' = 'confirmed';
    if (matchCheck.max_participants) {
      const { count } = await supabase
        .from('match_participants')
        .select('id', { count: 'exact', head: true })
        .eq('match_id', validMatchId)
        .eq('status', 'confirmed');
      if (count && count >= matchCheck.max_participants) {
        status = 'waitlisted';
      }
    }

    const { error: insertError } = await supabase.from('match_participants').insert({
      match_id: validMatchId,
      user_id: user.id,
      participant_type: 'member',
      status,
    });

    if (insertError) {
      if (insertError.code === '23505') throw new Error('이미 참가 신청했습니다');
      throw new Error('참가 신청에 실패했습니다');
    }
  }

  logInfo('match', 'Joined match', { userId: user.id, matchId: validMatchId });
}

export async function applyAsGuest(matchId: string, name: string, phone?: string | null, introduction?: string | null) {
  const validMatchId = uuidSchema.parse(matchId);
  const validated = guestApplySchema.parse({ name, phone: phone ?? undefined });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // Try RPC first (atomic with registration_closed check)
  const { error } = await supabase.rpc('join_match_atomically', {
    p_match_id: validMatchId,
    p_user_id: user.id,
    p_participant_type: 'guest',
    p_status: 'pending',
    p_guest_name: validated.name,
    p_guest_phone: validated.phone || null,
    p_introduction: introduction?.trim() || null,
  });

  if (error) {
    if (error.message?.includes('MATCH_NOT_FOUND')) throw new Error('경기를 찾을 수 없습니다');
    if (error.message?.includes('REGISTRATION_CLOSED')) throw new Error('모집이 마감되었습니다');
    if (error.message?.includes('MATCH_FULL')) throw new Error('참가 인원이 가득 찼습니다');
    if (error.code === '23505') throw new Error('이미 참가 신청했습니다');

    // RPC function might be outdated (missing p_introduction param) - fallback to direct insert with safety checks
    const { data: matchCheck } = await supabase
      .from('matches')
      .select('status, registration_closed, max_participants')
      .eq('id', validMatchId)
      .maybeSingle();

    if (!matchCheck) throw new Error('경기를 찾을 수 없습니다');
    if (matchCheck.status === 'completed' || matchCheck.status === 'cancelled') {
      throw new Error('종료되었거나 취소된 경기에는 참가할 수 없습니다');
    }
    if (matchCheck.registration_closed) throw new Error('모집이 마감되었습니다');

    const { error: insertError } = await supabase.from('match_participants').insert({
      match_id: validMatchId,
      user_id: user.id,
      participant_type: 'guest',
      status: 'pending',
      guest_name: validated.name,
      guest_phone: validated.phone || null,
      introduction: introduction?.trim() || null,
    });

    if (insertError) {
      if (insertError.code === '23505') throw new Error('이미 참가 신청했습니다');
      throw new Error('게스트 신청에 실패했습니다');
    }
  }
}

// 모집 마감/재오픈
export async function toggleRegistration(matchId: string) {
  const validMatchId = uuidSchema.parse(matchId);
  await requireMatchPermission(validMatchId, 'match.create');

  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select('registration_closed')
    .eq('id', validMatchId)
    .maybeSingle();

  if (!match) throw new Error('경기를 찾을 수 없습니다');

  const newValue = !match.registration_closed;

  const { error } = await supabase
    .from('matches')
    .update({ registration_closed: newValue })
    .eq('id', validMatchId);

  if (error) throw new Error('모집 상태 변경에 실패했습니다');

  return { closed: newValue };
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
    .maybeSingle();

  const { error } = await supabase
    .from('match_participants')
    .update({
      status: approved ? 'confirmed' : 'rejected',
      responded_at: new Date().toISOString(),
      responded_by: user.id,
    })
    .eq('id', validParticipantId);

  if (error) {
    logError('match', 'Failed to respond to guest', { userId: user.id, matchId: validMatchId, error });
    throw new Error('처리에 실패했습니다');
  }

  logInfo('match', `Guest ${approved ? 'approved' : 'rejected'}`, {
    userId: user.id,
    matchId: validMatchId,
    metadata: { participantId: validParticipantId, guestName: participant?.guest_name },
  });

  // 게스트 승인/거절 알림 전송
  if (participant?.user_id) {
    const { data: match } = await supabase
      .from('matches')
      .select('title, club_id')
      .eq('id', validMatchId)
      .maybeSingle();

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
      } catch (e) {
        logWarn('match', 'Failed to send guest response notification', { matchId: validMatchId, error: e });
      }
    }
  }
}

export async function withdrawFromMatch(matchId: string) {
  const validMatchId = uuidSchema.parse(matchId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // Prevent withdrawal from completed/cancelled matches
  const { data: match } = await supabase
    .from('matches')
    .select('status')
    .eq('id', validMatchId)
    .maybeSingle();

  if (match?.status === 'completed' || match?.status === 'cancelled') {
    throw new Error('종료되었거나 취소된 경기에서는 탈퇴할 수 없습니다');
  }

  // Check if the user was a confirmed participant (to know if we should promote waitlist)
  const { data: participant } = await supabase
    .from('match_participants')
    .select('status')
    .eq('match_id', validMatchId)
    .eq('user_id', user.id)
    .maybeSingle();

  const wasConfirmed = participant?.status === 'confirmed';

  await supabase
    .from('match_participants')
    .delete()
    .eq('match_id', validMatchId)
    .eq('user_id', user.id);

  logInfo('match', 'Withdrew from match', { userId: user.id, matchId: validMatchId });

  // If a confirmed participant withdrew, promote the next waitlisted participant
  if (wasConfirmed) {
    const { data: promotedId } = await supabase.rpc('promote_waitlist', {
      p_match_id: validMatchId,
    });

    // Send notification to promoted participant
    if (promotedId) {
      try {
        const { data: promoted } = await supabase
          .from('match_participants')
          .select('user_id')
          .eq('id', promotedId)
          .maybeSingle();

        if (promoted?.user_id) {
          const { data: matchInfo } = await supabase
            .from('matches')
            .select('title, club_id')
            .eq('id', validMatchId)
            .maybeSingle();

          if (matchInfo) {
            const { createNotification } = await import('@/lib/actions/notifications');
            await createNotification(
              promoted.user_id,
              'match_invite',
              '대기자 참가 확정',
              `"${matchInfo.title}" 경기에 대기에서 참가가 확정되었습니다.`,
              { match_id: validMatchId, club_id: matchInfo.club_id }
            );
          }
        }
      } catch (e) {
        logWarn('match', 'Failed to send waitlist promotion notification', { matchId: validMatchId, error: e });
      }
    }
  }
}

export async function leaveWaitlist(matchId: string) {
  const validMatchId = uuidSchema.parse(matchId);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // Only delete if the participant is waitlisted
  const { data: participant } = await supabase
    .from('match_participants')
    .select('id, status')
    .eq('match_id', validMatchId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!participant) throw new Error('대기 정보를 찾을 수 없습니다');
  if (participant.status !== 'waitlisted') throw new Error('대기 상태가 아닙니다');

  await supabase
    .from('match_participants')
    .delete()
    .eq('id', participant.id);
}

/**
 * 비회원(앱 미가입자) 참가자 직접 추가
 */
export async function addOfflineParticipant(matchId: string, name: string, gender: 'M' | 'F', ntrpLevel?: number) {
  const validMatchId = uuidSchema.parse(matchId);
  const validated = offlineParticipantSchema.parse({ name, gender, ntrpLevel });
  await requireMatchPermission(validMatchId, 'match.create');

  const supabase = await createClient();

  // Block adding participants to completed/cancelled matches
  const { data: match } = await supabase
    .from('matches')
    .select('status')
    .eq('id', validMatchId)
    .maybeSingle();

  if (match?.status === 'completed' || match?.status === 'cancelled') {
    throw new Error('종료되었거나 취소된 경기에는 참가자를 추가할 수 없습니다');
  }

  // 비회원은 user_id가 null이므로 RPC 대신 직접 insert
  // 운영진 추가이므로 모집 마감 여부와 관계없이 허용

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
    logError('match', 'Failed to add offline participant', { matchId: validMatchId, error });
    throw new Error('참가자 추가에 실패했습니다');
  }

  logInfo('match', 'Offline participant added', { matchId: validMatchId, metadata: { name: validated.name, gender: validated.gender } });
}

/**
 * 클럽 멤버를 경기 참가자로 추가 (운영진 전용)
 */
export async function addMemberParticipant(matchId: string, userId: string) {
  const validMatchId = uuidSchema.parse(matchId);
  const validUserId = uuidSchema.parse(userId);
  await requireMatchPermission(validMatchId, 'match.create');

  const supabase = await createClient();

  const { data: match } = await supabase
    .from('matches')
    .select('status')
    .eq('id', validMatchId)
    .maybeSingle();

  if (match?.status === 'completed' || match?.status === 'cancelled') {
    throw new Error('종료되었거나 취소된 경기에는 참가자를 추가할 수 없습니다');
  }

  // 중복 확인
  const { data: existing } = await supabase
    .from('match_participants')
    .select('id')
    .eq('match_id', validMatchId)
    .eq('user_id', validUserId)
    .maybeSingle();

  if (existing) {
    throw new Error('이미 참가 중인 멤버입니다');
  }

  const { error } = await supabase.from('match_participants').insert({
    match_id: validMatchId,
    user_id: validUserId,
    participant_type: 'member',
    status: 'confirmed',
  });

  if (error) {
    logError('match', 'Failed to add member participant', { matchId: validMatchId, userId: validUserId, error });
    throw new Error('참가자 추가에 실패했습니다');
  }

  logInfo('match', 'Member participant added by admin', { matchId: validMatchId, userId: validUserId });
}

/**
 * 참가자 삭제 (비회원 또는 본인)
 */
export async function removeParticipant(participantId: string, matchId: string): Promise<{ error?: string }> {
  try {
    const validParticipantId = uuidSchema.parse(participantId);
    const validMatchId = uuidSchema.parse(matchId);
    await requireMatchPermission(validMatchId, 'match.create');

    const supabase = await createClient();

    // Clear game references before deleting
    const { data: draws } = await supabase
      .from('draws')
      .select('id')
      .eq('match_id', validMatchId);

    if (draws && draws.length > 0) {
      const drawIds = draws.map(d => d.id);
      const { data: games } = await supabase
        .from('games')
        .select('id, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id')
        .in('draw_id', drawIds);

      if (games) {
        for (const game of games) {
          const updates: Record<string, null> = {};
          if (game.team_a_player1_id === validParticipantId) updates.team_a_player1_id = null;
          if (game.team_a_player2_id === validParticipantId) updates.team_a_player2_id = null;
          if (game.team_b_player1_id === validParticipantId) updates.team_b_player1_id = null;
          if (game.team_b_player2_id === validParticipantId) updates.team_b_player2_id = null;

          if (Object.keys(updates).length > 0) {
            await supabase.from('games').update(updates).eq('id', game.id);
          }
        }
      }
    }

    // Check if the participant being removed was confirmed
    const { data: removedParticipant } = await supabase
      .from('match_participants')
      .select('status')
      .eq('id', validParticipantId)
      .maybeSingle();

    const wasConfirmed = removedParticipant?.status === 'confirmed';

    const { error } = await supabase
      .from('match_participants')
      .delete()
      .eq('id', validParticipantId);

    if (error) {
      logError('match', 'Failed to remove participant', { matchId: validMatchId, error, metadata: { participantId: validParticipantId } });
      return { error: '참가자 삭제에 실패했습니다: ' + error.message };
    }

    logInfo('match', 'Participant removed', { matchId: validMatchId, metadata: { participantId: validParticipantId } });

    // Promote waitlisted participant if a confirmed one was removed
    if (wasConfirmed) {
      await supabase.rpc('promote_waitlist', { p_match_id: validMatchId });
    }

    return {};
  } catch (e) {
    logError('match', 'Failed to remove participant', { error: e });
    return { error: e instanceof Error ? e.message : '참가자 삭제에 실패했습니다' };
  }
}

/**
 * 참가자 대체 (기존 클럽 멤버로 교체)
 * - match_participants에서 oldParticipant를 교체
 * - 기존 대진표(games)에서 해당 선수가 배정된 모든 경기를 새 선수로 교체
 */
export async function replaceParticipant(matchId: string, oldParticipantId: string, newUserId: string): Promise<{ error?: string }> {
  try {
    const validMatchId = uuidSchema.parse(matchId);
    const validOldId = uuidSchema.parse(oldParticipantId);
    const validNewUserId = uuidSchema.parse(newUserId);
    await requireMatchPermission(validMatchId, 'match.create');

    const supabase = await createClient();

    // Check if the new user is already a participant
    const { data: existing } = await supabase
      .from('match_participants')
      .select('id')
      .eq('match_id', validMatchId)
      .eq('user_id', validNewUserId)
      .maybeSingle();

    if (existing) {
      return { error: '이미 참가 중인 멤버입니다' };
    }

    // Create new participant
    const { data: newParticipant, error: insertErr } = await supabase
      .from('match_participants')
      .insert({
        match_id: validMatchId,
        user_id: validNewUserId,
        participant_type: 'member',
        status: 'confirmed',
      })
      .select('id')
      .maybeSingle();

    if (insertErr || !newParticipant) return { error: '대체 선수 추가에 실패했습니다: ' + (insertErr?.message || 'no data') };

  // Find all games where oldParticipant is assigned and swap
  const { data: draws } = await supabase
    .from('draws')
    .select('id')
    .eq('match_id', validMatchId);

  if (draws && draws.length > 0) {
    const drawIds = draws.map(d => d.id);
    const { data: games } = await supabase
      .from('games')
      .select('id, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id')
      .in('draw_id', drawIds);

    if (games) {
      for (const game of games) {
        const updates: Record<string, string> = {};
        if (game.team_a_player1_id === validOldId) updates.team_a_player1_id = newParticipant.id;
        if (game.team_a_player2_id === validOldId) updates.team_a_player2_id = newParticipant.id;
        if (game.team_b_player1_id === validOldId) updates.team_b_player1_id = newParticipant.id;
        if (game.team_b_player2_id === validOldId) updates.team_b_player2_id = newParticipant.id;

        if (Object.keys(updates).length > 0) {
          await supabase.from('games').update(updates).eq('id', game.id);
        }
      }
    }
  }

  // Delete old participant
  const { error: deleteErr } = await supabase
    .from('match_participants')
    .delete()
    .eq('id', validOldId);

  if (deleteErr) return { error: '기존 참가자 삭제에 실패했습니다: ' + deleteErr.message };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : '대체에 실패했습니다' };
  }
}

/**
 * 참가자 대체 (비회원/오프라인 선수로 교체)
 */
export async function replaceWithOffline(
  matchId: string,
  oldParticipantId: string,
  name: string,
  gender: 'M' | 'F',
  ntrp?: number
): Promise<{ error?: string }> {
  try {
    const validMatchId = uuidSchema.parse(matchId);
    const validOldId = uuidSchema.parse(oldParticipantId);
    await requireMatchPermission(validMatchId, 'match.create');

    const supabase = await createClient();

    // Create new offline participant
    const { data: newParticipant, error: insertErr } = await supabase
      .from('match_participants')
      .insert({
        match_id: validMatchId,
        user_id: null,
        guest_name: name,
        guest_gender: gender,
        participant_type: 'guest',
        status: 'confirmed',
        ntrp_override: ntrp || null,
      })
      .select('id')
      .maybeSingle();

    if (insertErr || !newParticipant) return { error: '대체 선수 추가에 실패했습니다: ' + (insertErr?.message || 'no data') };

  // Find all games where oldParticipant is assigned and swap
  const { data: draws } = await supabase
    .from('draws')
    .select('id')
    .eq('match_id', validMatchId);

  if (draws && draws.length > 0) {
    const drawIds = draws.map(d => d.id);
    const { data: games } = await supabase
      .from('games')
      .select('id, team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id')
      .in('draw_id', drawIds);

    if (games) {
      for (const game of games) {
        const updates: Record<string, string> = {};
        if (game.team_a_player1_id === validOldId) updates.team_a_player1_id = newParticipant.id;
        if (game.team_a_player2_id === validOldId) updates.team_a_player2_id = newParticipant.id;
        if (game.team_b_player1_id === validOldId) updates.team_b_player1_id = newParticipant.id;
        if (game.team_b_player2_id === validOldId) updates.team_b_player2_id = newParticipant.id;

        if (Object.keys(updates).length > 0) {
          await supabase.from('games').update(updates).eq('id', game.id);
        }
      }
    }
  }

  // Delete old participant
  const { error: deleteErr } = await supabase
    .from('match_participants')
    .delete()
    .eq('id', validOldId);

  if (deleteErr) return { error: '기존 참가자 삭제에 실패했습니다: ' + deleteErr.message };
    return {};
  } catch (e) {
    return { error: e instanceof Error ? e.message : '대체에 실패했습니다' };
  }
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
    .maybeSingle();

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

// Valid match status transitions
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  upcoming: ['in_progress', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: [],           // terminal state
  cancelled: ['upcoming'], // can reopen a cancelled match
};

export async function updateMatchStatus(matchId: string, status: string) {
  const validMatchId = uuidSchema.parse(matchId);
  const validStatus = matchStatusSchema.parse(status);
  await requireMatchPermission(validMatchId, 'match.create');

  const supabase = await createClient();

  // Validate state transition
  const { data: match } = await supabase
    .from('matches')
    .select('status')
    .eq('id', validMatchId)
    .maybeSingle();

  if (!match) throw new Error('경기를 찾을 수 없습니다');

  const allowed = VALID_STATUS_TRANSITIONS[match.status] || [];
  if (!allowed.includes(validStatus)) {
    throw new Error(`현재 상태(${match.status})에서 ${validStatus}(으)로 변경할 수 없습니다`);
  }

  const { error } = await supabase
    .from('matches')
    .update({ status: validStatus, updated_at: new Date().toISOString() })
    .eq('id', validMatchId);

  if (error) throw new Error('상태 변경에 실패했습니다');
}
