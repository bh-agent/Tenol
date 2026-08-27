import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { logError, logInfo, logWarn } from '@/lib/logger';
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

  // 2.5 내가 클럽장(owner)인 클럽 처리 — 멤버가 남아있으면 운영권을 위임,
  //     아무도 없으면 클럽을 삭제(연관 데이터는 CASCADE 정리).
  //     이 단계가 없으면 클럽장이 떠난 클럽이 운영자 없이 방치된다(고아 클럽).
  try {
    // throwOnError()로 쿼리 오류도 아래 catch에서 잡아 500 처리(silent 무시 방지).
    const { data: ownedClubs } = await adminClient
      .from('club_members')
      .select('club_id')
      .eq('user_id', user.id)
      .eq('role', 'owner')
      .throwOnError();

    for (const { club_id } of ownedClubs ?? []) {
      // 후임자 우선순위: 다른 owner → admin → member, 동일 역할이면 먼저 가입한 사람
      const { data: candidates } = await adminClient
        .from('club_members')
        .select('user_id, role, joined_at')
        .eq('club_id', club_id)
        .neq('user_id', user.id)
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true })
        .limit(1)
        .throwOnError();

      const successor = candidates?.[0];
      if (successor) {
        await adminClient
          .from('club_members')
          .update({ role: 'owner' })
          .eq('club_id', club_id)
          .eq('user_id', successor.user_id)
          .throwOnError();
        await adminClient
          .from('clubs')
          .update({ created_by: successor.user_id })
          .eq('id', club_id)
          .throwOnError();
      } else {
        // 남은 멤버가 없으면 클럽 삭제 (members/matches/draws 등 CASCADE)
        await adminClient.from('clubs').delete().eq('id', club_id).throwOnError();
      }
    }
  } catch (e) {
    logError('club', 'Ownership handover during account deletion failed', { error: e, path: '/api/account/delete', userId: user.id });
    return NextResponse.json({ error: '클럽 운영권 정리 중 오류가 발생했습니다' }, { status: 500 });
  }

  // 2.5. 작성한 모집글 삭제 — created_by가 SET NULL이라 방치하면 회원모집 글이
  //      작성자 '알 수 없음'으로 영구히 열린 채 남는다(자동 마감 대상도 아님).
  try {
    await adminClient.from('recruitment_posts').delete().eq('created_by', user.id);
  } catch (e) {
    logWarn('recruitment', '계정 삭제 시 모집글 정리 실패', { error: e, userId: user.id });
  }

  // 3. profiles 삭제 (CASCADE + ON DELETE SET NULL로 관련 데이터 정리)
  //    ⚠️ 생성자 참조(created_by 등)가 ON DELETE SET NULL이어야 삭제가 성공한다.
  //    마이그레이션 00040_account_deletion_fk_fix.sql 적용 필요.
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
