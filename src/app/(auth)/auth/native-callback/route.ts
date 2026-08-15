import { NextResponse } from 'next/server';

// 네이티브 앱(Capacitor) OAuth용 중간 콜백 라우트.
// Supabase가 redirect_to로 허용하는 URL은 https여야 하므로
// 이 HTTPS 엔드포인트를 Supabase Redirect URLs에 등록한 뒤,
// 여기서 커스텀 URL scheme(app.tenol.club://)으로 즉시 포워딩한다.
// OS가 딥링크를 앱(appUrlOpen)에 전달하고, 인앱 브라우저는 앱 쪽에서 Browser.close()로 닫는다.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  if (error) {
    return NextResponse.redirect(
      `app.tenol.club://auth/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription ?? '')}`
    );
  }

  if (code) {
    // 코드를 앱으로 전달 — WebView의 supabase 클라이언트가 code_verifier와 함께 교환
    return NextResponse.redirect(
      `app.tenol.club://auth/callback?code=${encodeURIComponent(code)}`
    );
  }

  return NextResponse.redirect('app.tenol.club://auth/callback?error=missing_code');
}
