'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { Capacitor } from '@capacitor/core';
import Image from 'next/image';
import { useState } from 'react';

export default function LoginPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState<string | null>(null);

  const handleOAuthLogin = async (provider: 'kakao' | 'google') => {
    setLoading(provider);
    const redirectTo = `${window.location.origin}/auth/callback`;

    if (Capacitor.isNativePlatform()) {
      const { data } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
          ...(provider === 'kakao' ? {
            scopes: 'profile_nickname profile_image',
            queryParams: { scope: 'profile_nickname profile_image' },
          } : {}),
        },
      });

      if (data?.url) {
        const { Browser } = await import('@capacitor/browser');
        let polling: ReturnType<typeof setInterval> | null = null;

        const checkSession = async () => {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            if (polling) clearInterval(polling);
            try { await Browser.close(); } catch {}
            window.location.href = '/clubs';
          }
        };

        const listener = await Browser.addListener('browserFinished', async () => {
          listener.remove();
          if (polling) clearInterval(polling);
          await checkSession();
        });

        polling = setInterval(checkSession, 1500);
        await Browser.open({ url: data.url, presentationStyle: 'popover' });
      }
    } else {
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          ...(provider === 'kakao' ? {
            scopes: 'profile_nickname profile_image',
            queryParams: { scope: 'profile_nickname profile_image' },
          } : {}),
        },
      });
    }
    setLoading(null);
  };

  const handleAppleLogin = async () => {
    setLoading('apple');
    try {
      // Load Apple JS SDK
      await loadAppleScript();

      // @ts-ignore - AppleID is loaded from script
      const response = await window.AppleID.auth.signIn();

      if (response.authorization?.id_token) {
        const { error, data } = await supabase.auth.signInWithIdToken({
          provider: 'apple',
          token: response.authorization.id_token,
        });

        if (!error && data.user) {
          // Apple이 제공한 이름을 프로필에 자동 저장
          // Apple JS SDK는 최초 가입 시에만 response.user에 이름/이메일을 제공함
          // 트리거가 display_name을 '사용자'로 기본 설정하므로, 기본값일 때만 덮어쓰기
          const appleUser = response.user;
          const fullName = appleUser?.name
            ? [appleUser.name.firstName, appleUser.name.lastName].filter(Boolean).join(' ').trim()
            : '';
          const emailLocal = appleUser?.email ? appleUser.email.split('@')[0] : '';
          const candidate = fullName || emailLocal;

          if (candidate) {
            // 트리거가 채운 기본값('사용자')일 때만 진짜 이름으로 교체
            // 사용자가 이미 닉네임을 직접 정한 경우 덮어쓰지 않음
            await supabase
              .from('profiles')
              .update({
                display_name: candidate,
                real_name: fullName || null,
              })
              .eq('id', data.user.id)
              .eq('display_name', '사용자');
          }

          window.location.href = '/clubs';
          return;
        }
        console.error('Supabase Apple signIn error:', error);
      }
    } catch (e: any) {
      if (e?.error !== 'popup_closed_by_user') {
        console.error('Apple login error:', e);
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="relative flex flex-col items-center justify-between min-h-screen px-6 py-12 bg-background overflow-hidden">
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

      <div className="flex-1" />

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
        <p className="text-subtle text-sm">클럽 운영을 더 쉽고 즐겁게</p>
      </div>

      <div className="flex-1 min-h-12" />

      {/* Login Buttons */}
      <div className="relative z-10 w-full max-w-sm space-y-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        {/* Apple Login */}
        <button
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

        {/* Kakao Login */}
        <button
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

        {/* Google Login */}
        <button
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
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-10 mb-2 animate-fade-in" style={{ animationDelay: '0.5s' }}>
        <p className="text-xs text-subtle text-center leading-relaxed">
          로그인하면 테놀의{' '}
          <a href="/terms" className="text-muted-foreground underline underline-offset-2">이용약관</a> 및{' '}
          <a href="/privacy" className="text-muted-foreground underline underline-offset-2">개인정보 처리방침</a>에
          동의하게 됩니다.
        </p>
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
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
