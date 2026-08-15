import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** 내부 경로만 허용 (open redirect 방지) */
function sanitizeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/**
 * 로그인 성공 후 이동: 307 리다이렉트 대신 잠깐 머무는 HTML로 응답.
 *
 * iOS WKWebView는 리다이렉트 응답의 Set-Cookie(세션 쿠키)를 저장소에 커밋하기 전에
 * 다음 요청을 보내는 경우가 있어, 첫 로그인 시도가 세션 없이 /login으로 튕기는
 * 레이스가 발생한다. 150ms 뒤 클라이언트 측에서 이동하면 쿠키가 확실히 실린다.
 */
function htmlRedirect(dest: string) {
  const safe = JSON.stringify(dest).replace(/</g, '\\u003c');
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>로그인 중…</title><style>body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0A0A0A;color:#999;font-family:-apple-system,'Pretendard',sans-serif;font-size:14px}</style></head><body>로그인 중…<script>setTimeout(function(){location.replace(${safe})},150)</script></body></html>`;
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = sanitizeNext(searchParams.get('next'));

  // OAuth 에러 처리
  if (error) {
    console.error('OAuth callback error:', error, errorDescription);
    return NextResponse.redirect(`${origin}/login?error=${error}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_onboarded')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.is_onboarded) {
          // 온보딩 완료 후 원래 목적지(초대 링크 등)로 복귀할 수 있게 전달
          return htmlRedirect(
            `/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`
          );
        }
      }
      return htmlRedirect(next ?? '/clubs');
    }

    console.error('Code exchange failed:', exchangeError);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

export async function POST(request: Request) {
  // Apple Sign In uses POST for the callback with form data
  const formData = await request.formData();
  const code = formData.get('code') as string | null;
  const state = formData.get('state') as string | null;
  const error = formData.get('error') as string | null;

  const origin = new URL(request.url).origin;

  if (error) {
    console.error('Apple OAuth POST error:', error);
    return NextResponse.redirect(`${origin}/login?error=${error}`);
  }

  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('is_onboarded')
          .eq('id', user.id)
          .maybeSingle();

        if (!profile?.is_onboarded) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }
      return NextResponse.redirect(`${origin}/clubs`);
    }

    console.error('Apple code exchange failed:', exchangeError);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
