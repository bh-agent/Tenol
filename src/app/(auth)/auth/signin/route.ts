import { createClient } from '@/lib/supabase/server';
import { HANDOFF_MARKER_COOKIE } from '@/lib/auth-handoff';
import { logError } from '@/lib/logger';
import { NextResponse } from 'next/server';

// OAuth 시작을 서버에서 처리하는 라우트.
//
// 클라이언트(supabase-js)가 signInWithOAuth를 호출하면 PKCE code verifier가
// document.cookie로 저장되는데, iOS WKWebView에서는 이 쓰기가 네트워크 쿠키
// 저장소에 커밋되기 전에 공급자 페이지로 이동해 유실된다(실측 로그로 확인).
// 서버에서 시작하면 verifier가 302 응답의 Set-Cookie(HTTP 쿠키)로 심어져
// 리다이렉트를 따라가기 전에 반드시 저장된다.
//
// native=1: 네이티브 앱이 외부 브라우저로 이 URL을 연 경우. 마커 쿠키만 심고,
// 실제 세션 전달 토큰은 콜백이 서버에서 생성한다(공격자가 토큰을 고를 수 없게).

const PROVIDERS = new Set(['kakao', 'google', 'apple']);

/** 내부 경로만 허용 (open redirect 방지) */
function sanitizeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const provider = searchParams.get('provider');
  const next = sanitizeNext(searchParams.get('next'));
  const isNative = searchParams.get('native') === '1';

  if (!provider || !PROVIDERS.has(provider)) {
    return NextResponse.redirect(`${origin}/login?error=invalid_provider`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: provider as 'kakao' | 'google' | 'apple',
    options: {
      redirectTo: `${origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`,
      ...(provider === 'kakao'
        ? {
            scopes: 'profile_nickname profile_image',
            queryParams: { scope: 'profile_nickname profile_image' },
          }
        : {}),
    },
  });

  if (error || !data?.url) {
    console.error('OAuth start failed:', error);
    await logError('auth', 'OAuth 시작 실패 (signInWithOAuth 서버)', {
      path: '/auth/signin',
      error,
      metadata: { provider, isNative },
    });
    return NextResponse.redirect(`${origin}/login?error=oauth_start`);
  }

  // cookies().set으로 심긴 verifier 쿠키는 Next가 이 리다이렉트 응답에 합쳐준다
  const res = NextResponse.redirect(data.url);
  if (isNative) {
    // 콜백이 "네이티브 핸드오프"로 처리하도록 표시하는 마커(비밀 아님)
    res.cookies.set(HANDOFF_MARKER_COOKIE, '1', {
      path: '/auth',
      maxAge: 600,
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });
  }
  return res;
}
