import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 인증 불필요 경로
  const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/auth');

  // 미인증 유저 → 로그인으로
  if (!user && !isAuthRoute) {
    console.warn(JSON.stringify({ level: 'warn', category: 'auth', message: 'Unauthenticated access', path: pathname }));
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // 인증된 유저 → 로그인 페이지 접근 차단
  if (user && pathname.startsWith('/login')) {
    const url = request.nextUrl.clone();
    url.pathname = '/clubs';
    return NextResponse.redirect(url);
  }

  // 인증된 유저 → 온보딩 체크
  if (user && !isAuthRoute) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_onboarded')
      .eq('id', user.id)
      .maybeSingle();

    if (pathname === '/onboarding') {
      // 온보딩 완료 유저가 /onboarding 접근 시 → 홈으로
      if (profile?.is_onboarded) {
        const url = request.nextUrl.clone();
        url.pathname = '/clubs';
        return NextResponse.redirect(url);
      }
    } else {
      // 온보딩 미완료 유저 → 온보딩으로
      if (profile && !profile.is_onboarded) {
        const url = request.nextUrl.clone();
        url.pathname = '/onboarding';
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}
