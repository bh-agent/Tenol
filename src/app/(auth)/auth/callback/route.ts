import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

/** 내부 경로만 허용 (open redirect 방지) */
function sanitizeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
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
          return NextResponse.redirect(
            `${origin}/onboarding${next ? `?next=${encodeURIComponent(next)}` : ''}`
          );
        }
      }
      return NextResponse.redirect(`${origin}${next ?? '/clubs'}`);
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
