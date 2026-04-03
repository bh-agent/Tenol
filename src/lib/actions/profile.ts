'use server';

import { createClient } from '@/lib/supabase/server';
import { logError, logInfo } from '@/lib/logger';
import {
  updateProfileSchema,
  completeOnboardingSchema,
  avatarUrlSchema,
} from '@/lib/validations';

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // tennis_start_date: "2023-05" 형태를 "2023-05-01"로 변환 (DB는 DATE 타입)
  const startMonth = formData.get('tennis_start_date') as string;
  const tennisStartDate = startMonth ? `${startMonth}-01` : null;

  const genderRaw = formData.get('gender') as string | null;

  const realNameRaw = formData.get('real_name') as string | null;

  const validated = updateProfileSchema.parse({
    display_name: formData.get('display_name'),
    real_name: realNameRaw || null,
    bio: formData.get('bio') as string || null,
    ntrp_level: formData.get('ntrp_level') ? Number(formData.get('ntrp_level')) : null,
    tennis_start_date: tennisStartDate,
    gender: genderRaw || undefined,
  });

  const updateData: Record<string, unknown> = {
    display_name: validated.display_name,
    real_name: validated.real_name,
    bio: validated.bio,
    ntrp_level: validated.ntrp_level,
    updated_at: new Date().toISOString(),
  };

  if (validated.gender) {
    updateData.gender = validated.gender;
  }

  if (validated.tennis_start_date !== undefined) {
    updateData.tennis_start_date = validated.tennis_start_date;
  }

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id);

  if (error) {
    // tennis_start_date 컬럼이 없는 경우 해당 필드 제외하고 재시도
    if (error.message?.includes('tennis_start_date')) {
      delete updateData.tennis_start_date;
      const { error: retryError } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', user.id);
      if (retryError) {
        logError('profile', 'Failed to update profile (retry)', { userId: user.id, error: retryError });
        throw new Error('프로필 수정에 실패했습니다');
      }
      logInfo('profile', 'Profile updated (without tennis_start_date)', { userId: user.id });
      return;
    }
    logError('profile', 'Failed to update profile', { userId: user.id, error });
    throw new Error('프로필 수정에 실패했습니다');
  }

  logInfo('profile', 'Profile updated', { userId: user.id });
}

export async function updateProfileAvatar(avatarUrl: string) {
  const validUrl = avatarUrlSchema.parse(avatarUrl);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: validUrl, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    logError('profile', 'Failed to update avatar', { userId: user.id, error });
    throw new Error('프로필 사진 변경에 실패했습니다');
  }

  logInfo('profile', 'Avatar updated', { userId: user.id });
}

/**
 * 온보딩 완료 처리
 */
export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const ntrpRaw = formData.get('ntrp_level') as string | null;

  const validated = completeOnboardingSchema.parse({
    display_name: formData.get('display_name'),
    real_name: formData.get('real_name'),
    gender: formData.get('gender'),
    region: (formData.get('region') as string) || null,
    bio: (formData.get('bio') as string) || null,
    ntrp_level: ntrpRaw ? Number(ntrpRaw) : null,
  });

  const updateData: Record<string, unknown> = {
    display_name: validated.display_name,
    real_name: validated.real_name,
    gender: validated.gender,
    region: validated.region,
    bio: validated.bio,
    ntrp_level: validated.ntrp_level,
    is_onboarded: true,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id);

  if (error) {
    logError('profile', 'Failed to complete onboarding', { userId: user.id, error });
    throw new Error('프로필 설정에 실패했습니다');
  }

  logInfo('profile', 'Onboarding completed', { userId: user.id });
}

/**
 * 온보딩에서 프로필 사진 업로드
 */
export async function uploadOnboardingAvatar(avatarUrl: string) {
  const validUrl = avatarUrlSchema.parse(avatarUrl);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: validUrl })
    .eq('id', user.id);

  if (error) throw new Error('사진 업로드에 실패했습니다');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

/**
 * 계정 삭제 - API 라우트를 통해 auth.users까지 완전 삭제
 * 서버 액션에서는 service_role 키를 쓸 수 없으므로 API 라우트로 위임
 */
export async function deleteAccount() {
  // 이 함수는 더 이상 직접 삭제하지 않음
  // 클라이언트에서 /api/account/delete를 직접 호출해야 함
  throw new Error('클라이언트에서 API를 직접 호출하세요');
}
