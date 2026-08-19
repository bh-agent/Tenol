import { NextResponse } from 'next/server';

// 구버전 앱(딥링크 방식 로그인 페이지 JS 캐시) 호환용 콜백.
//
// 과거에는 여기서 app.tenol.club:// 커스텀 스킴으로 307 리다이렉트했지만,
// SFSafariViewController/Chrome Custom Tabs는 서버 리다이렉트로 커스텀 스킴을
// 여는 것을 차단하는 경우가 많고 iOS 18.4+는 쿼리 파라미터까지 제거한다.
// 표준 패턴대로 HTTPS 인터스티셜을 렌더하고 사용자 탭 버튼(+Android 자동 시도)으로
// 딥링크를 연다. 현행 로그인 플로우는 이 라우트를 쓰지 않는다(세션 핸드오프 방식).
const PARAM_RE = /^[\x20-\x7E]{1,2048}$/; // 인쇄 가능한 ASCII만 (스킴 URL 삽입 안전)

function interstitial(deepLink: string, message: string) {
  const safeLink = JSON.stringify(deepLink).replace(/</g, '\\u003c');
  const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>테놀로 돌아가기</title><style>
body{margin:0;min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0A0A0A;color:#EDEDED;font-family:-apple-system,'Pretendard',sans-serif;text-align:center}
.card{padding:32px 24px;max-width:320px}
p{font-size:14px;color:#999;line-height:1.6;margin:0 0 28px}
a.btn{display:block;padding:16px;border-radius:16px;background:#00E676;color:#0A0A0A;font-weight:700;font-size:16px;text-decoration:none}
</style></head><body><div class="card">
<p>${message}</p>
<a class="btn" id="open">테놀 앱으로 돌아가기</a>
<script>
var link=${safeLink};
document.getElementById('open').setAttribute('href',link);
if(/Android/i.test(navigator.userAgent)){setTimeout(function(){try{location.href=link}catch(e){}},400)}
</script>
</div></body></html>`;
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description') ?? '';

  if (error && PARAM_RE.test(error)) {
    return interstitial(
      `app.tenol.club://auth/callback?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDescription.slice(0, 500))}`,
      '로그인이 취소되었거나 실패했습니다.<br>앱으로 돌아가 다시 시도해주세요.'
    );
  }

  if (code && PARAM_RE.test(code)) {
    return interstitial(
      `app.tenol.club://auth/callback?code=${encodeURIComponent(code)}`,
      '로그인 확인이 완료되었습니다.<br>아래 버튼을 눌러 테놀 앱으로 돌아가주세요.'
    );
  }

  return interstitial('app.tenol.club://auth/callback?error=missing_code', '잘못된 접근입니다.');
}
