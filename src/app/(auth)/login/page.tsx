'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { Capacitor } from '@capacitor/core';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 네이티브 OAuth redirect_uri: Google/Kakao는 https만 허용하므로
// 서버 라우트(/auth/native-callback)가 app.tenol.club:// 딥링크로 포워딩한다.
const NATIVE_REDIRECT = 'https://tenol-one.vercel.app/auth/native-callback';

type OAuthProvider = 'apple' | 'kakao' | 'google';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 버튼 순서: 기본은 카카오 우선(한국 사용자 대다수).
  // SSR과 첫 클라이언트 렌더가 일치해야 하므로 기본값으로 렌더한 뒤,
  // 마운트 후 iOS 네이티브에서만 Apple 우선으로 교체한다(앱 심사 요건).
  const [order, setOrder] = useState<OAuthProvider[]>(['kakao', 'google', 'apple']);

  useEffect(() => {
    if (Capacitor.getPlatform() === 'ios') {
      setOrder(['apple', 'kakao', 'google']);
    }
  }, []);

  // 웹/PWA: Apple JS SDK를 미리 받아둬서 탭 시점에 CDN 로딩을
  // 기다리느라 스피너가 오래 걸리는 문제를 방지한다.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      loadAppleScript().catch(() => {});
    }
  }, []);

  // appUrlOpen: OAuth 완료 후 iOS가 보내는 딥링크 처리
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: { remove: () => void } | null = null;

    const setup = async () => {
      const { App } = await import('@capacitor/app');
      const { Browser } = await import('@capacitor/browser');

      listenerHandle = await App.addListener('appUrlOpen', async ({ url }) => {
        try {
          const parsed = new URL(url);
          // app.tenol.club://auth/callback?code=...
          const code = parsed.searchParams.get('code');
          if (code) {
            setLoading('oauth-callback');
            const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            if (exchangeError) {
              setError('로그인에 실패했습니다. 다시 시도해주세요.');
            } else {
              try { await Browser.close(); } catch {}
              router.replace('/clubs');
            }
          }
        } catch {
          setError('로그인 처리 중 오류가 발생했습니다.');
        } finally {
          setLoading(null);
        }
      });
    };

    setup();
    return () => { listenerHandle?.remove(); };
  }, [supabase, router]);

  const handleOAuthLogin = async (provider: 'kakao' | 'google') => {
    setLoading(provider);
    setError(null);

    try {
      if (Capacitor.isNativePlatform()) {
        // 네이티브: 커스텀 스킴으로 리디렉션 → iOS가 딥링크로 앱에 전달
        // SFSafariViewController는 non-http scheme 탐색 시 자동으로 닫힘
        const { data } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: NATIVE_REDIRECT,
            skipBrowserRedirect: true,
            ...(provider === 'kakao' ? {
              scopes: 'profile_nickname profile_image',
              queryParams: { scope: 'profile_nickname profile_image' },
            } : {}),
          },
        });

        if (data?.url) {
          const { Browser } = await import('@capacitor/browser');
          await Browser.open({ url: data.url, presentationStyle: 'fullscreen' });
        }
        // 이후 처리는 appUrlOpen 리스너에서 담당
      } else {
        // 웹/PWA: 기존 방식 유지
        await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            ...(provider === 'kakao' ? {
              scopes: 'profile_nickname profile_image',
              queryParams: { scope: 'profile_nickname profile_image' },
            } : {}),
          },
        });
      }
    } catch (e) {
      console.error('OAuth login error:', e);
      setError('로그인 중 문제가 발생했습니다. 다시 시도해주세요.');
      setLoading(null);
    }
    // 네이티브 성공 시 loading은 appUrlOpen 핸들러에서 해제
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

    window.location.href = '/clubs';
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

      // 웹/PWA: Apple JS SDK 팝업
      await loadAppleScript();
      // @ts-ignore - AppleID is loaded from script
      const response = await window.AppleID.auth.signIn();
      if (response.authorization?.id_token) {
        const appleUser = response.user;
        const fullName = appleUser?.name
          ? [appleUser.name.firstName, appleUser.name.lastName].filter(Boolean).join(' ').trim()
          : '';
        await finishAppleSignIn(response.authorization.id_token, fullName, appleUser?.email ?? '');
      } else {
        setError('Apple 로그인에 실패했습니다. 다시 시도해주세요.');
      }
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
            disabled={loading !== null}
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
            disabled={loading !== null}
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
            disabled={loading !== null}
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

// Apple JS SDK 로드
function loadAppleScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).AppleID) {
      // 이미 초기화된 경우 재설정
      (window as any).AppleID.auth.init({
        clientId: 'app.tenol.club.service',
        scope: 'name email',
        redirectURI: window.location.origin + '/auth/callback',
        usePopup: true,
      });
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.onload = () => {
      (window as any).AppleID.auth.init({
        clientId: 'app.tenol.club.service',
        scope: 'name email',
        redirectURI: window.location.origin + '/auth/callback',
        usePopup: true,
      });
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}
