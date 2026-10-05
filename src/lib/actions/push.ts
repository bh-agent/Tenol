'use server';

import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';
import { z } from 'zod';

const saveTokenSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.enum(['ios', 'android', 'web']),
});

/** 네이티브 앱에서 발급받은 푸시 토큰을 현재 사용자에 저장 (upsert) */
export async function saveDeviceToken(token: string, platform: 'ios' | 'android' | 'web') {
  const validated = saveTokenSchema.parse({ token, platform });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return; // 로그인 전이면 조용히 무시

  // RPC 사용: 같은 기기에서 다른 계정으로 로그인하면 토큰을 현재 유저로 재배정.
  // (기존 upsert는 이전 유저 소유 행의 UPDATE가 RLS에 막혀 2주간 36회 실패 —
  //  해당 유저는 푸시를 못 받았음. 00054 마이그레이션 참고)
  const { error } = await supabase.rpc('save_device_token', {
    p_token: validated.token,
    p_platform: validated.platform,
  });

  if (error) {
    logError('system', '디바이스 토큰 저장 실패', {
      userId: user.id,
      metadata: { code: error.code, message: error.message },
    });
  }
}

/** 로그아웃 시 현재 기기의 토큰 제거 */
export async function removeDeviceToken(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('device_tokens').delete().eq('token', token).eq('user_id', user.id);
}

/**
 * 특정 사용자의 모든 기기로 푸시 발송 (서버 내부용).
 * createNotification에서 fire-and-forget로 호출된다.
 * FCM 미설정 시 즉시 no-op. 무효 토큰은 자동 정리.
 */
// sendPushToUser는 서버 전용 모듈로 이동함(액션 엔드포인트 노출 방지): @/lib/server/notify
