'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isPushConfigured, sendToToken, type PushPayload } from '@/lib/push/fcm';
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

  const { error } = await supabase.from('device_tokens').upsert(
    {
      token: validated.token,
      user_id: user.id,
      platform: validated.platform,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'token' },
  );

  if (error) {
    logError('system', '디바이스 토큰 저장 실패', { userId: user.id, error });
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
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!isPushConfigured()) return;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) return;

  // 타 사용자의 토큰을 읽어야 하므로 service-role 사용 (RLS 우회)
  const admin = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokens } = await admin
    .from('device_tokens')
    .select('token')
    .eq('user_id', userId);

  if (!tokens || tokens.length === 0) return;

  const invalidTokens: string[] = [];
  await Promise.all(
    tokens.map(async (row: { token: string }) => {
      try {
        const result = await sendToToken(row.token, payload);
        if (result === 'invalid') invalidTokens.push(row.token);
      } catch {
        // 발송 실패는 무시 (인앱 알림은 이미 저장됨)
      }
    }),
  );

  if (invalidTokens.length > 0) {
    await admin.from('device_tokens').delete().in('token', invalidTokens);
  }
}
