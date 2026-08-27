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

  // getSession() = 로컬 JWT 파싱, 네트워크 없음.
  // 보안: 서버 컴포넌트/API Route는 getUser()를 사용해야 하지만
  // 미들웨어는 쿠키 갱신 전달이 주목적이므로 getSession()으로 충분하다.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user ?? null;
  const pathname = request.nextUrl.pathname;

  // 공개 경로: 로그인/OAuth 콜백 + 약관·개인정보처리방침(앱스토어 심사관이 미로그인으로 접근)
  // + 클럽 초대 링크(/clubs/join) — SNS 미리보기 스크래퍼·미로그인 방문자가 클럽 정보를
  //   볼 수 있어야 초대 카드 이미지(클럽 로고)가 뜬다. 실제 가입은 여전히 로그인 필요.
  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/terms') ||
    pathname.startsWith('/privacy') ||
    pathname.startsWith('/clubs/join');

  // 미인증 → 로그인 (원래 목적지를 ?next=로 보존 — 초대 링크 등 복귀용)
  if (!user && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/' && pathname !== '/clubs') {
      url.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(url);
  }

  // 인증된 유저가 로그인 페이지 접근 시 → next 목적지(내부 경로만) 또는 홈으로
  if (user && pathname.startsWith('/login')) {
    const nextParam = request.nextUrl.searchParams.get('next');
    const url = request.nextUrl.clone();
    url.search = '';
    url.pathname =
      nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') && !nextParam.includes('\\')
        ? nextParam
        : '/clubs';
    return NextResponse.redirect(url);
  }

  // 온보딩·정지 체크는 (main)/layout.tsx 서버 컴포넌트에서 처리
  // (미들웨어는 모든 RSC 요청에서 실행되므로 DB 쿼리를 여기서 하면 매 클릭마다 지연 발생)

  return supabaseResponse;
}
