import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logError, logInfo } from '@/lib/logger';
import { NextResponse } from 'next/server';

export async function POST() {
  // 1. 현재 로그인한 유저 확인 (anon 키 사용)
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // ignore
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });
  }

  // 2. service_role 키로 관리자 클라이언트 생성
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 });
  }

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 3. profiles 삭제 (CASCADE로 관련 데이터 정리)
  const { error: profileError } = await adminClient
    .from('profiles')
    .delete()
    .eq('id', user.id);

  if (profileError) {
    logError('profile', 'Profile deletion failed', { error: profileError, path: '/api/account/delete', userId: user.id });
    return NextResponse.json({ error: '프로필 삭제 실패' }, { status: 500 });
  }

  // 4. auth.users에서 유저 삭제
  const { error: authError } = await adminClient.auth.admin.deleteUser(user.id);
  if (authError) {
    logError('auth', 'Auth user deletion failed', { error: authError, path: '/api/account/delete', userId: user.id });
    return NextResponse.json({ error: '계정 삭제 실패' }, { status: 500 });
  }

  // 5. 세션 쿠키 정리
  await supabase.auth.signOut();

  logInfo('auth', 'Account deleted', { userId: user.id, path: '/api/account/delete' });

  return NextResponse.json({ success: true });
}
