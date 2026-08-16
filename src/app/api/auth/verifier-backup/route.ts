import { NextResponse } from 'next/server';

// PKCE verifier 쿠키 백업 라우트.
//
// iOS WKWebView는 document.cookie 쓰기 직후 페이지를 떠나면(OAuth 이동)
// 쿠키가 네트워크 쿠키 저장소에 반영되기 전에 유실될 수 있다 —
// "PKCE code verifier not found in storage"로 첫 로그인이 실패하는 원인.
// 로그인 페이지가 이동 직전 verifier 쿠키를 여기로 보내면, 서버가 같은 값을
// Set-Cookie 헤더로 다시 심는다 (HTTP 응답 쿠키는 유실 없이 저장됨).
//
// 보안: 이름/값 형식을 엄격히 검증하고 supabase verifier 쿠키만 허용.
// verifier는 비밀이 아니라 CSRF-방지용 일회성 챌린지 짝이므로
// 본인 브라우저에 재설정하는 것은 안전하다.
const NAME_RE = /^sb-[a-z0-9]+-auth-token-code-verifier(\.\d+)?$/;
const VALUE_RE = /^[A-Za-z0-9%._~-]{1,4096}$/;

export async function POST(request: Request) {
  let body: { cookies?: Array<{ name?: unknown; value?: unknown }> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const cookies = Array.isArray(body.cookies) ? body.cookies.slice(0, 4) : [];
  const res = NextResponse.json({ ok: true });
  res.headers.set('Cache-Control', 'no-store');

  for (const c of cookies) {
    if (typeof c?.name !== 'string' || typeof c?.value !== 'string') continue;
    if (!NAME_RE.test(c.name) || !VALUE_RE.test(c.value)) continue;
    res.headers.append(
      'Set-Cookie',
      `${c.name}=${c.value}; Path=/; Max-Age=600; SameSite=Lax; Secure`
    );
  }

  return res;
}
