import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * service_role 키로 RLS를 우회하는 관리자용 Supabase 클라이언트.
 *
 * 반드시 서버에서만, 그리고 호출하는 쪽에서 이미 권한 검사를 마친 뒤에만 사용한다.
 * (예: 다른 사용자에게 알림 생성, 푸시 토큰 조회 등 RLS로는 불가능한 내부 작업)
 *
 * 환경 변수가 없으면 null을 반환하므로 호출부에서 graceful하게 처리할 것.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
