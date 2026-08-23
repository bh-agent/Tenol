'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { Capacitor } from '@capacitor/core';
import Image from 'next/image';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type OAuthProvider = 'apple' | 'kakao' | 'google';

// 네이티브 핸드오프 최대 대기 (외부 브라우저 로그인이 이 시간 안에 안 끝나면 초기화)
const HANDOFF_TIMEOUT_MS = 4 * 60 * 1000;

/** 서버가 딥링크로 준 핸드오프 토큰 형식 (hex 48자) */
const HANDOFF_TOKEN_RE = /^[a-f0-9]{48}$/;

/** 로그인 후 복귀 경로 검증: 내부 경로만 허용 (open redirect 방지) */
function sanitizeNext(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
}

/**
 * 웹/구버전 앱의 OAuth 시작 URL.
 *
 * 서버 라우트(/auth/signin)가 PKCE verifier를 302 응답의 Set-Cookie로 심고
 * 공급자로 리다이렉트한다. 클라이언트 document.cookie 저장은 iOS WKWebView에서
 * 공급자 페이지로 이동하는 사이 유실되는 것이 실측 로그로 확인돼(첫 로그인
 * 실패의 원인) 서버 시작 방식으로 교체했다. HTTP 쿠키는 유실 레이스가 없다.
 */
function serverSignInUrl(provider: OAuthProvider, next: string | null): string {
  return `/auth/signin?provider=${provider}${next ? `&next=${encodeURIComponent(next)}` : ''}`;
}

function LoginContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 네이티브 세션 핸드오프 진행 상태 (외부 브라우저에서 로그인 진행 중)
  const [handoff, setHandoff] = useState<{ provider: string } | null>(null);
  const claimBusyRef = useRef(false);
  const claimedRef = useRef(false); // 성공 후 재진입(브라우저 닫힘/재개) 방지
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 초대 링크 등에서 넘어온 복귀 목적지 (미들웨어가 ?next=로 전달)
  const next = sanitizeNext(searchParams.get('next'));
  const destination = next ?? '/clubs';

  // ── 네이티브 세션 핸드오프 ─────────────────────────────────────────
  // Capacitor WebView는 OAuth 공급자로의 이동을 외부 브라우저로 넘기므로,
  // 로그인은 외부 브라우저에서 끝나고 세션도 거기에만 남는다. 서버가 로그인을
  // 마친 '본인 기기'에만 일회용 토큰을 딥링크로 전달하고, 앱은 그 토큰으로
  // 세션을 HTTP Set-Cookie로 수령한다(document.cookie 미사용 → WKWebView 유실 없음).

  const clearHandoffTimer = () => {
    if (handoffTimerRef.current) {
      clearTimeout(handoffTimerRef.current);
      handoffTimerRef.current = null;
    }
  };

  /** 딥링크로 받은 토큰으로 세션 수령. 성공하면 브라우저를 닫고 목적지로 이동 */
  const claimSession = useCallback(async (token: string): Promise<void> => {
    if (!HANDOFF_TOKEN_RE.test(token)) return;
    if (claimedRef.current || claimBusyRef.current) return;
    claimBusyRef.current = true;
    try {
      const res = await fetch('/api/auth/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
      if (!res.ok || json.ok !== true) {
        // 토큰이 유효하지 않음(만료·재사용·손상) — 사용자에게 알리고 초기화
        claimBusyRef.current = false;
        clearHandoffTimer();
        setHandoff(null);
        setLoading(null);
        setError('로그인 확인에 실패했습니다. 다시 시도해주세요.');
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.close();
        } catch {}
        return;
      }

      claimedRef.current = true;
      clearHandoffTimer();
      setHandoff(null);
      setLoading('oauth-callback'); // 이동할 때까지 버튼 잠금 유지
      try {
        const { Browser } = await import('@capacitor/browser');
        await Browser.close();
      } catch {}
      // 세션 쿠키는 HTTP 응답으로 이미 심어졌으므로 전체 내비게이션으로 이동.
      // (미들웨어가 쿠키를 읽어 인증 통과 → 목적지 렌더)
      window.location.href = destination;
    } catch {
      // 네트워크 오류 — 딥링크/버튼 재시도로 회복 가능하므로 상태 유지
      claimBusyRef.current = false;
    }
  }, [destination]);

  const cancelHandoff = useCallback(async () => {
    clearHandoffTimer();
    setHandoff(null);
    setLoading(null);
    try {
      const { Browser } = await import('@capacitor/browser');
      await Browser.close();
    } catch {}
  }, []);

  /** 외부 브라우저 로그인을 시작하고 대기 상태로 전환 */
  const beginHandoff = useCallback((provider: 'kakao' | 'google') => {
    claimedRef.current = false;
    claimBusyRef.current = false;
    setHandoff({ provider });
    clearHandoffTimer();
    handoffTimerRef.current = setTimeout(() => {
      if (claimedRef.current) return;
      setHandoff(null);
      setLoading(null);
      setError('로그인 시간이 초과되었습니다. 다시 시도해주세요.');
    }, HANDOFF_TIMEOUT_MS);
  }, []);

  // 언마운트 시 진행 중 타이머 정리 (메모리 누수/유령 setState 방지)
  useEffect(() => () => clearHandoffTimer(), []);

  // 정지 계정·OAuth 실패 안내 (미들웨어/콜백이 쿼리로 전달)
  useEffect(() => {
    if (searchParams.get('banned') === '1') {
      setError('이용이 정지된 계정입니다. 문의: forybh2@gmail.com');
    } else if (searchParams.get('error')) {
      setError('로그인에 실패했습니다. 다시 시도해주세요.');
    }
  }, [searchParams]);

  // 온보딩이 필요한 신규 유저도 목적지를 잃지 않도록 백업
  // (온보딩 완료 화면이 sessionStorage에서 읽어 복귀)
  useEffect(() => {
    if (next) {
      try { sessionStorage.setItem('tenol_next', next); } catch {}
    }
  }, [next]);

  // WKWebView 쿠키 커밋 지연으로 로그인 직후 /login으로 튕긴 경우 자동 복구:
  // 세션이 이미 있으면 즉시 목적지로 이동 (마운트 시 + 0.6초 후 재확인)
  //
  // 추가로 화면 복귀 시에도 복구한다:
  // - bfcache 복원(pageshow persisted) / 앱 백그라운드 복귀(visibilitychange):
  //   OAuth 도중 이탈했다 돌아오면 loading이 남아 버튼이 비활성(흐릿)로
  //   먹통이 되는 문제 → 세션 있으면 이동, 없으면 버튼 복구
  useEffect(() => {
    let cancelled = false;
    const recover = async () => {
      // 핸드오프 완료 후 이동 중이면 건드리지 않는다
      if (claimedRef.current) return;
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) {
          router.replace(destination);
          return;
        }
      } catch {}
      // 세션 없이 돌아옴 — 핸드오프 대기 중이 아니라면 버튼 복구.
      // (대기 중이면 딥링크/버튼으로 완료되므로 화면 유지)
      if (!cancelled && !handoff) {
        setLoading((prev) => (prev === 'oauth-callback' ? prev : null));
      }
    };
    const check = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!cancelled && session) router.replace(destination);
      } catch {}
    };
    check();
    const t = setTimeout(check, 600);

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) recover();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') recover();
    };
    window.addEventListener('pageshow', onPageShow);
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener('pageshow', onPageShow);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [supabase, router, destination, handoff]);
  // 버튼 순서: 기본은 카카오 우선(한국 사용자 대다수).
  // SSR과 첫 클라이언트 렌더가 일치해야 하므로 기본값으로 렌더한 뒤,
  // 마운트 후 iOS 네이티브에서만 Apple 우선으로 교체한다(앱 심사 요건).
  const [order, setOrder] = useState<OAuthProvider[]>(['kakao', 'google', 'apple']);

  useEffect(() => {
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      // iOS는 앱 심사 요건상 Apple 우선
      setOrder(['apple', 'kakao', 'google']);
    } else if (platform === 'android') {
      // Android는 Apple 로그인 불필요(심사 요건 아님) + 네이티브 Apple 플러그인
      // 미지원이라 버튼을 숨긴다. 카카오/구글만 노출.
      setOrder(['kakao', 'google']);
    }
    // web/PWA: 기본값 유지 (kakao, google, apple)
  }, []);

  // appUrlOpen: OAuth 완료 후 OS가 보내는 딥링크 처리 (성공 code / 취소·실패 error 모두)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let urlListener: { remove: () => void } | null = null;
    let finishListener: { remove: () => void } | null = null;

    const setup = async () => {
      const { App } = await import('@capacitor/app');
      const { Browser } = await import('@capacitor/browser');

      urlListener = await App.addListener('appUrlOpen', async ({ url }) => {
        try {
          // app.tenol.club://auth/handoff?token=... — 인터스티셜의 '앱으로 돌아가기'
          // (콜드 스타트 포함: OS가 앱 실행 URL로 이 리스너를 호출)
          if (!url.includes('auth/handoff')) return;
          const token = new URL(url).searchParams.get('token');
          if (token) claimSession(token);
        } catch {}
      });

      // 사용자가 브라우저를 로그인 완료 없이 직접 닫은 경우 대기 상태 해제.
      // (완료로 닫힌 경우엔 claimedRef가 서 있어 건드리지 않는다)
      finishListener = await Browser.addListener('browserFinished', () => {
        if (claimedRef.current || claimBusyRef.current) return;
        clearHandoffTimer();
        setHandoff(null);
        setLoading(null);
      });
    };

    setup();
    return () => {
      urlListener?.remove();
      finishListener?.remove();
    };
  }, [claimSession]);

  const handleOAuthLogin = async (provider: 'kakao' | 'google') => {
    setError(null);

    try {
      if (Capacitor.isNativePlatform()) {
        // 네이티브: Capacitor WebView는 외부 호스트(OAuth 공급자) 이동을 가로채
        // 외부 브라우저를 띄우므로(쿠키 저장소가 분리됨), 처음부터 외부 브라우저에서
        // 로그인 전 과정을 진행한다. 세션은 서버가 로그인 완료한 본인 기기에만
        // 딥링크로 전달하는 일회용 토큰으로 수령한다(app.tenol.club://auth/handoff).
        // 구글은 WebView 내 OAuth를 정책적으로 차단하므로 이 방식이 유일하게 안전하다.
        const url = `${window.location.origin}/auth/signin?provider=${provider}&native=1${next ? `&next=${encodeURIComponent(next)}` : ''}`;
        beginHandoff(provider);
        try {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url, presentationStyle: 'fullscreen' });
        } catch {
          // 아주 오래된 빌드(Browser 플러그인 없음): WebView 이동 —
          // Capacitor가 외부 호스트 도달 시점에 외부 브라우저로 연다
          window.location.href = url;
        }
        // 이후 처리는 appUrlOpen(딥링크)·browserFinished가 담당
      } else {
        // 웹/PWA: 서버 라우트가 verifier를 HTTP 쿠키로 심고 공급자로 이동.
        // 같은 화면으로 /auth/callback에 돌아와 세션 쿠키가 저장된다.
        setLoading(provider);
        window.location.href = serverSignInUrl(provider, next);
        return; // 페이지 이탈 — loading 유지 (복귀 시 pageshow/visibilitychange에서 복구)
      }
    } catch (e) {
      console.error('OAuth login error:', e);
      setError('로그인 중 문제가 발생했습니다. 다시 시도해주세요.');
      setLoading(null);
      clearHandoffTimer();
      setHandoff(null);
    }
  };

  // id_token 확보 후 공통 처리: Supabase 로그인 + 이름 자동 채우기 + 이동
  const finishAppleSignIn = async (idToken: string, fullName: string, email: string) => {
    const { error: signInError, data } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: idToken,
    });

    if (signInError || !data.user) {
      console.error('Supabase Apple signIn error:', signInError);
      setError('Apple 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    // Apple은 최초 가입 시에만 이름/이메일을 제공.
    // 트리거가 display_name을 '사용자'로 채우므로 기본값일 때만 진짜 이름으로 교체.
    const emailLocal = email ? email.split('@')[0] : '';
    const candidate = (fullName || emailLocal).trim();
    if (candidate) {
      await supabase
        .from('profiles')
        .update({ display_name: candidate, real_name: fullName || null })
        .eq('id', data.user.id)
        .eq('display_name', '사용자');
    }

    window.location.href = destination;
  };

  const handleAppleLogin = async () => {
    setLoading('apple');
    setError(null);
    try {
      // 네이티브(iOS): 웹 팝업(JS SDK)은 WKWebView에서 동작이 불안정하므로
      // 네이티브 Sign in with Apple(ASAuthorization)을 사용한다.
      if (Capacitor.isNativePlatform()) {
        const { SignInWithApple } = await import('@capacitor-community/apple-sign-in');
        const result = await SignInWithApple.authorize({
          clientId: 'app.tenol.club', // 네이티브는 번들 ID가 audience
          redirectURI: `${window.location.origin}/auth/callback`,
          scopes: 'name email',
        });

        const idToken = result.response?.identityToken;
        if (!idToken) {
          setError('Apple 로그인에 실패했습니다. 다시 시도해주세요.');
          return;
        }
        const fullName = [result.response?.givenName, result.response?.familyName]
          .filter(Boolean)
          .join(' ')
          .trim();
        await finishAppleSignIn(idToken, fullName, result.response?.email ?? '');
        return;
      }

      // 웹/PWA: Supabase가 Apple OAuth를 직접 처리 (카카오/구글과 동일한 검증된 경로).
      // Apple JS SDK 팝업은 브라우저 환경에 따라 "문제가 발생했습니다. 다시
      // 시도하십시오." 오류가 잦아 전체 페이지 리디렉션 방식으로 교체함.
      // 서버 라우트가 verifier를 HTTP 쿠키로 심는다 (WKWebView 유실 방지).
      window.location.href = serverSignInUrl('apple', next);
      return; // 페이지 이탈 — 이후 처리는 /auth/callback에서
    } catch (e: any) {
      // 사용자가 직접 취소한 경우는 에러로 표시하지 않음.
      // 네이티브 플러그인은 code 없이 메시지만 reject하므로(예: "...error 1001.")
      // 메시지로도 취소를 판별한다. (웹은 e.error === 'popup_closed_by_user')
      const code = e?.error ?? e?.code;
      const msg = String(e?.message ?? e ?? '');
      const canceled =
        code === 'popup_closed_by_user' ||
        /\b1001\b/.test(msg) || // ASAuthorizationError.canceled
        /cancell?ed|취소/i.test(msg);
      if (!canceled) {
        console.error('Apple login error:', e);
        setError('Apple 로그인 중 문제가 발생했습니다. 다시 시도해주세요.');
      }
    } finally {
      setLoading(null);
    }
  };

  // 로그인 버튼 렌더링 — 순서는 order 상태를 따른다
  const renderLoginButton = (provider: OAuthProvider) => {
    switch (provider) {
      case 'apple':
        return (
          <button
            key="apple"
            onClick={handleAppleLogin}
            disabled={loading !== null || handoff !== null}
            className={cn(
              'group w-full h-14 rounded-2xl font-semibold text-white bg-black border-2 border-white',
              'flex items-center justify-center gap-3',
              'transition-all duration-200 ease-out',
              'hover:bg-black/80 active:scale-[0.97]',
              'disabled:opacity-60'
            )}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" className="transition-transform group-hover:scale-110">
              <path fill="white" d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
            </svg>
            {loading === 'apple' ? '로그인 중...' : 'Apple로 시작하기'}
          </button>
        );
      case 'kakao':
        return (
          <button
            key="kakao"
            onClick={() => handleOAuthLogin('kakao')}
            disabled={loading !== null || handoff !== null}
            className={cn(
              'group w-full h-14 rounded-2xl font-semibold text-[#191919] bg-[#FEE500] border-2 border-[#E5CE00]',
              'flex items-center justify-center gap-3',
              'transition-all duration-200 ease-out',
              'hover:bg-[#FDD835] active:scale-[0.97]',
              'disabled:opacity-60'
            )}
          >
            <svg width="20" height="20" viewBox="0 0 18 18" className="transition-transform group-hover:scale-110">
              <path fill="#191919" d="M9 1C4.58 1 1 3.79 1 7.21c0 2.17 1.45 4.08 3.64 5.18-.16.57-.58 2.07-.67 2.39-.1.39.14.39.3.28.12-.08 1.93-1.31 2.71-1.84.64.09 1.3.14 1.98.14 4.42 0 8-2.79 8-6.21S13.42 1 9 1" />
            </svg>
            {loading === 'kakao' ? '로그인 중...' : '카카오로 시작하기'}
          </button>
        );
      case 'google':
        return (
          <button
            key="google"
            onClick={() => handleOAuthLogin('google')}
            disabled={loading !== null || handoff !== null}
            className={cn(
              'group w-full h-14 rounded-2xl font-semibold text-[#1F1F1F] bg-white border-2 border-gray-300',
              'flex items-center justify-center gap-3',
              'transition-all duration-200 ease-out',
              'hover:bg-white/90 active:scale-[0.97]',
              'disabled:opacity-60'
            )}
          >
            <svg width="20" height="20" viewBox="0 0 18 18" className="transition-transform group-hover:scale-110">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
            </svg>
            {loading === 'google' ? '로그인 중...' : 'Google로 시작하기'}
          </button>
        );
    }
  };

  return (
    <div className="relative flex flex-col min-h-dvh bg-background overflow-hidden">
      {/* Background gradient orb */}
      <div
        className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 w-[600px] h-[600px] rounded-full opacity-20"
        style={{
          background:
            'radial-gradient(circle, rgba(0,230,118,0.3) 0%, rgba(0,230,118,0.05) 50%, transparent 70%)',
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* 상단 여백 (safe area + 로고 공간) */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pt-[max(env(safe-area-inset-top),48px)] pb-6">
        {/* Branding */}
        <div className="relative z-10 flex flex-col items-center stagger">
          <div className="relative mb-8">
            <div className="w-24 h-24 rounded-3xl overflow-hidden glow-primary shadow-lg shadow-primary/20">
              <Image
                src="/icons/icon-192.png"
                alt="테놀"
                width={96}
                height={96}
                className="w-full h-full object-cover"
                priority
              />
            </div>
            <div className="absolute -top-2 -right-2 w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
            <div className="absolute -bottom-1 -left-3 w-1.5 h-1.5 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: '1s' }} />
          </div>

          <h1 className="text-5xl font-bold text-gradient mb-3 tracking-tight">테놀</h1>
          <p className="text-muted-foreground text-lg mb-2">테니스 치며 놀자</p>
          <p className="text-subtle text-sm mb-6">클럽 운영을 더 쉽고 즐겁게</p>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {['대진표 자동 생성', '경기 기록 · MVP', '게스트 모집'].map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 rounded-full bg-surface-elevated/70 border border-border text-xs text-muted-foreground"
              >
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Login Buttons — sticky at bottom, always visible */}
      <div className="relative z-10 px-6 w-full max-w-sm mx-auto space-y-3 animate-fade-in pb-[max(env(safe-area-inset-bottom),24px)]" style={{ animationDelay: '0.3s' }}>
        {handoff && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-medium">브라우저에서 로그인을 진행해주세요</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              로그인이 끝나면 자동으로 이어집니다
            </p>
            <button
              onClick={cancelHandoff}
              className="text-xs text-subtle underline underline-offset-2"
            >
              취소
            </button>
          </div>
        )}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive text-center"
          >
            {error}
          </div>
        )}
        {/* 플랫폼별 순서로 로그인 버튼 렌더링 */}
        {order.map(renderLoginButton)}
      </div>

      {/* Footer */}
      <p className="relative z-10 mt-4 text-xs text-subtle text-center leading-relaxed animate-fade-in px-6 pb-2" style={{ animationDelay: '0.5s' }}>
        로그인하면 테놀의{' '}
        <a href="/terms" className="text-muted-foreground underline underline-offset-2">이용약관</a> 및{' '}
        <a href="/privacy" className="text-muted-foreground underline underline-offset-2">개인정보 처리방침</a>에
        동의하게 됩니다.
      </p>
    </div>
  );
}

// useSearchParams는 Suspense 경계가 필요 (Next.js 요건)
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}

