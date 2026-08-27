import { createClient } from '@/lib/supabase/server';
import {
  HANDOFF_MARKER_COOKIE,
  makeHandoffToken,
  storeHandoffSession,
} from '@/lib/auth-handoff';
import { logError } from '@/lib/logger';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/** 내부 경로만 허용 (open redirect 방지) */
function sanitizeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
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

/** 네이티브 핸드오프 요청인지 판별 (마커 쿠키 존재 여부, 값은 검증 불필요) */
function hasHandoffMarker(request: Request): boolean {
  const header = request.headers.get('cookie') ?? '';
  return header
    .split(';')
    .map((c) => c.trim())
    .some((c) => c.startsWith(`${HANDOFF_MARKER_COOKIE}=`));
}

/**
 * 네이티브 핸드오프 완료 화면 (외부 브라우저에 표시).
 *
 * 서버가 생성한 일회용 토큰을 커스텀 스킴 딥링크로 앱에 전달한다. 토큰은
 * 오직 이 화면(=로그인을 마친 본인 기기)에만 나타나므로, 공격자가 만든 링크로
 * 유도해도 공격자는 토큰을 볼 수 없다(세션 고정 공격 차단).
 * 사용자가 '앱으로 돌아가기'를 누르면 OS가 앱을 열고(appUrlOpen) 앱이 세션을
 * 수령한다. Android는 자동 시도, iOS는 사용자 탭(권장 표준 패턴).
 */
function handoffInterstitial(kind: 'success' | 'error', token: string) {
  // token은 makeHandoffToken()이 만든 hex 48자만 들어오므로 HTML 삽입에 안전
  const deepLink = `app.tenol.club://auth/handoff?token=${token}`;
  const title = kind === 'success' ? '로그인 완료' : '로그인 실패';
  const heading = kind === 'success' ? '로그인 완료!' : '로그인에 실패했습니다';
  const desc =
    kind === 'success'
      ? '테놀 앱으로 돌아가면 자동으로 로그인됩니다.<br>돌아가지지 않으면 아래 버튼을 눌러주세요.'
      : '테놀 앱으로 돌아가 다시 시도해주세요.';
  const icon = kind === 'success' ? '✓' : '!';
  const iconColor = kind === 'success' ? '#00E676' : '#FF5252';
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0A0A0A;color:#EDEDED;font-family:-apple-system,'Pretendard',sans-serif;text-align:center}
.card{padding:32px 24px;max-width:320px}
.icon{width:64px;height:64px;border-radius:50%;border:2px solid ${iconColor};color:${iconColor};font-size:32px;line-height:60px;margin:0 auto 20px}
h1{font-size:20px;margin:0 0 12px}
p{font-size:14px;color:#999;line-height:1.6;margin:0 0 28px}
a.btn{display:block;padding:16px;border-radius:16px;background:#00E676;color:#0A0A0A;font-weight:700;font-size:16px;text-decoration:none}
.hint{font-size:12px;color:#666;margin-top:16px}
</style></head><body><div class="card">
<div class="icon">${icon}</div>
<h1>${heading}</h1>
<p>${desc}</p>
<a class="btn" id="back" href="${deepLink}">테놀 앱으로 돌아가기</a>
<div class="hint">'주소가 유효하지 않다'는 오류가 뜨면<br>앱이 최신 버전이 아닙니다 — 앱을 업데이트한 뒤<br>이 창을 닫고 다시 로그인해주세요.</div>
<script>
// 성공 시 딥링크 자동 시도(앱 자동 복귀). 실패해도 버튼으로 수동 복귀 가능.
// iOS는 "테놀에서 열기?" 확인창이 뜰 수 있어 사용자 탭이 가장 확실하다.
(function(){
  var link = ${JSON.stringify(`app.tenol.club://auth/handoff?token=${token}`)};
  var auto = ${kind === 'success' ? 'true' : 'false'};
  if (auto) { setTimeout(function(){ try { location.href = link; } catch(e){} }, 500); }
})();
</script>
</div></body></html>`;
  const res = new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
  // 일회용 마커 쿠키 정리
  res.cookies.set(HANDOFF_MARKER_COOKIE, '', { path: '/auth', maxAge: 0 });
  return res;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = sanitizeNext(searchParams.get('next'));

  const isHandoff = hasHandoffMarker(request);

  // OAuth 에러 처리
  if (error) {
    console.error('OAuth callback error:', error, errorDescription);
    await logError('auth', 'OAuth 콜백에 공급자 에러 도착', {
      path: '/auth/callback',
      metadata: { error, errorDescription, isHandoff },
    });
    if (isHandoff) return handoffInterstitial('error', makeHandoffToken());
    return NextResponse.redirect(`${origin}/login?error=${encodeURIComponent(error)}`);
  }

  // 네이티브 앱 핸드오프: 외부 브라우저에서 진행된 로그인.
  // 세션을 이 브라우저의 쿠키에 남기지 않고(리프레시 토큰 이중 사용 방지),
  // 서버가 생성한 일회용 토큰으로 저장소에 넣은 뒤 딥링크로 앱에 전달한다.
  if (code && isHandoff) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll(); // verifier 쿠키 읽기용
          },
          setAll() {
            // 의도적 no-op: 세션 쿠키를 이 외부 브라우저에 심지 않는다
          },
        },
      }
    );
    const { data: exchangeData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError || !exchangeData.session) {
      await logError('auth', '핸드오프 코드 교환 실패', {
        path: '/auth/callback',
        error: exchangeError,
        metadata: { exchangeMessage: exchangeError?.message ?? 'no session' },
      });
      await new Promise((r) => setTimeout(r, 400));
      return handoffInterstitial('error', makeHandoffToken());
    }

    // 토큰은 여기서만 만들어 성공 화면에만 노출 → 본인 기기 외엔 알 수 없다
    const token = makeHandoffToken();
    const stored = await storeHandoffSession(token, {
      access_token: exchangeData.session.access_token,
      refresh_token: exchangeData.session.refresh_token,
    });
    if (!stored) {
      await logError('auth', '핸드오프 세션 저장 실패', { path: '/auth/callback' });
      await new Promise((r) => setTimeout(r, 400));
      return handoffInterstitial('error', makeHandoffToken());
    }
    return handoffInterstitial('success', token);
  }

  if (code) {
    const supabase = await createClient();
    const { data: exchangeData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    // 진단용: 첫 시도 실패 문제 추적 — 실패 시 원인과 verifier 쿠키 존재 여부 기록
    if (exchangeError) {
      const cookieHeader = request.headers.get('cookie') ?? '';
      const cookieNames = cookieHeader
        .split(';')
        .map((c) => c.split('=')[0].trim())
        .filter(Boolean);
      await logError('auth', '코드 교환 실패 (첫 시도 실패 추적)', {
        path: '/auth/callback',
        error: exchangeError,
        metadata: {
          exchangeMessage: exchangeError.message,
          exchangeStatus: (exchangeError as { status?: number }).status ?? null,
          hasVerifierCookie: cookieNames.some((n) => n.includes('code-verifier')),
          hasAuthTokenCookie: cookieNames.some((n) => n.includes('auth-token') && !n.includes('verifier')),
          cookieNames: cookieNames.filter((n) => n.startsWith('sb-')),
          userAgent: (request.headers.get('user-agent') ?? '').slice(0, 120),
          referer: request.headers.get('referer') ?? null,
        },
      });
      // logError는 fire-and-forget — 서버리스 함수가 응답 후 얼어붙기 전에
      // insert가 도착하도록 실패 경로에서만 잠시 대기 (진단용)
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!exchangeError) {
      // 교환 응답에 이미 검증된 user가 있으므로 getUser() 재조회(왕복 1회) 불필요
      const user = exchangeData.user;
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
    const { data: exchangeData, error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      const user = exchangeData.user;
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
