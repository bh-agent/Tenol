import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { isPushConfigured, sendToToken, type PushPayload } from '@/lib/push/fcm';
import { uuidSchema } from '@/lib/validations';
import type { NotificationType } from '@/types';

// 이 두 함수는 'use server' 액션 엔드포인트로 노출하면 안 된다(임의 사용자에게
// 위조 알림·푸시 발송 가능). 서버 내부에서 권한 검증을 마친 액션이 import해 쓴다.

/** 대상 사용자에게 인앱 알림 생성 + (설정 시) 푸시 발송. 서버 내부 전용. */
export async function createNotification(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  data: Record<string, string> = {},
) {
  const validUserId = uuidSchema.parse(userId);
  const sanitizedTitle = title.replace(/<[^>]*>/g, '').slice(0, 200);
  const sanitizedBody = body.replace(/<[^>]*>/g, '').slice(0, 1000);

  // notifications INSERT는 RLS로 막혀 있어(타 사용자 위조 방지) service_role로 삽입.
  const supabase = createServiceRoleClient() ?? (await createClient());

  const { error } = await supabase.from('notifications').insert({
    user_id: validUserId,
    type,
    title: sanitizedTitle,
    body: sanitizedBody,
    data,
  });

  if (error) throw new Error('알림 생성에 실패했습니다');

  try {
    await sendPushToUser(validUserId, { title: sanitizedTitle, body: sanitizedBody, data });
  } catch {
    // 푸시 실패는 인앱 알림에 영향 없음
  }
}

/** 대상 사용자의 모든 기기에 FCM 푸시 발송. 서버 내부 전용. */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!isPushConfigured()) return;

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) return;

  const admin = createServiceClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokens } = await admin.from('device_tokens').select('token').eq('user_id', userId);
  if (!tokens || tokens.length === 0) return;

  const invalidTokens: string[] = [];
  await Promise.all(
    tokens.map(async (row: { token: string }) => {
      try {
        const result = await sendToToken(row.token, payload);
        if (result === 'invalid') invalidTokens.push(row.token);
      } catch {
        // 발송 실패 무시
      }
    }),
  );

  if (invalidTokens.length > 0) {
    await admin.from('device_tokens').delete().in('token', invalidTokens);
  }
}
