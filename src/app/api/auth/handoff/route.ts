import { claimHandoffSession, HANDOFF_TOKEN_RE } from '@/lib/auth-handoff';
import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';
import { NextResponse } from 'next/server';

// 네이티브 앱 세션 핸드오프 수령 엔드포인트.
//
// 앱 WebView가 외부 브라우저 로그인이 끝나기를 기다리며 이 라우트를 폴링한다.
// 세션이 준비되면 서버가 setSession으로 검증한 뒤 HTTP Set-Cookie로 심어준다 —
// document.cookie를 전혀 쓰지 않으므로 WKWebView 쿠키 유실 문제가 없다.
//
// 토큰은 일회용(수령 즉시 삭제)이며 5분 TTL. 아직 준비 전이면 pending으로 응답.
export async function POST(request: Request) {
  let token: unknown;
  try {
    ({ token } = await request.json());
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_request' }, { status: 400 });
  }

  if (typeof token !== 'string' || !HANDOFF_TOKEN_RE.test(token)) {
    return NextResponse.json({ ok: false, reason: 'bad_token' }, { status: 400 });
  }

  const session = await claimHandoffSession(token);
  if (!session) {
    // 아직 로그인이 끝나지 않았거나(정상 폴링), 만료/이미 수령됨
    return new NextResponse(
      JSON.stringify({ ok: false, reason: 'pending' }),
      { status: 404, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }

  // 서버 클라이언트로 세션 설정 → @supabase/ssr이 세션 쿠키를 이 응답에 심는다
  const supabase = await createClient();
  const { data, error } = await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  if (error || !data.session) {
    await logError('auth', '핸드오프 세션 설정 실패', {
      path: '/api/auth/handoff',
      error,
    });
    return new NextResponse(
      JSON.stringify({ ok: false, reason: 'invalid_session' }),
      { status: 410, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
