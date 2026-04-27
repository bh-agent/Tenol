'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';
import { Capacitor } from '@capacitor/core';
import Image from 'next/image';

export default function LoginPage() {
  const supabase = createClient();

  const handleOAuthLogin = async (provider: 'kakao' | 'google' | 'apple') => {
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

        // OAuth 완료 후 세션을 폴링으로 감지 (browserFinished는 iOS에서 불안정)
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
          // 브라우저 닫힌 후 최종 세션 확인
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

      {/* Subtle grid pattern overlay */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top spacer */}
      <div className="flex-1" />

      {/* Branding Section */}
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

        <h1 className="text-5xl font-bold text-gradient mb-3 tracking-tight">
          테놀
        </h1>

        <p className="text-muted-foreground text-lg mb-2">
          테니스 치며 놀자
        </p>
        <p className="text-subtle text-sm">
          클럽 운영을 더 쉽고 즐겁게
        </p>
      </div>

      {/* Spacer */}
      <div className="flex-1 min-h-12" />

      {/* Login Buttons */}
      <div className="relative z-10 w-full max-w-sm space-y-3 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        {/* Apple Login */}
        <button
          onClick={() => handleOAuthLogin('apple')}
          className={cn(
            'group w-full h-14 rounded-2xl font-semibold text-white bg-black border border-white/10',
            'flex items-center justify-center gap-3',
            'transition-all duration-200 ease-out',
            'hover:bg-black/80 hover:shadow-[0_0_30px_rgba(255,255,255,0.05)]',
            'active:scale-[0.97]'
          )}
        >
          <svg width="20" height="20" viewBox="0 0 17 20" className="transition-transform group-hover:scale-110">
            <path fill="white" d="M13.545 10.239c-.022-2.234 1.823-3.306 1.906-3.359-.038-.057-1.504-2.234-2.113-2.234-.607 0-1.258.34-1.612.34-.354 0-.95-.331-1.562-.322-.804.01-1.545.468-1.959 1.189-.836 1.45-.214 3.6.6 4.778.398.576.874 1.222 1.498 1.199.601-.024.828-.389 1.554-.389.726 0 .935.389 1.573.377.648-.01 1.06-.588 1.454-1.165.459-.668.648-1.315.66-1.349-.014-.006-1.266-.486-1.279-1.929-.012-1.206.985-1.784 1.03-1.815-.562-.826-1.437-.917-1.748-.94zm-1.018-3.429c.331-.401.554-.959.493-1.515-.477.019-.1.055.318-.996.36 0 .701.32 1.046.319.914-.002 1.115-.608 1.446-1.009z"/>
          </svg>
          Apple로 시작하기
        </button>

        {/* Kakao Login */}
        <button
          onClick={() => handleOAuthLogin('kakao')}
          className={cn(
            'group w-full h-14 rounded-2xl font-semibold text-[#191919] bg-[#FEE500]',
            'flex items-center justify-center gap-3',
            'transition-all duration-200 ease-out',
            'hover:bg-[#FDD835] hover:shadow-[0_0_30px_rgba(254,229,0,0.15)]',
            'active:scale-[0.97]'
          )}
        >
          <svg width="20" height="20" viewBox="0 0 18 18" className="transition-transform group-hover:scale-110">
            <path
              fill="#191919"
              d="M9 1C4.58 1 1 3.79 1 7.21c0 2.17 1.45 4.08 3.64 5.18-.16.57-.58 2.07-.67 2.39-.1.39.14.39.3.28.12-.08 1.93-1.31 2.71-1.84.64.09 1.3.14 1.98.14 4.42 0 8-2.79 8-6.21S13.42 1 9 1"
            />
          </svg>
          카카오로 시작하기
        </button>

        {/* Google Login */}
        <button
          onClick={() => handleOAuthLogin('google')}
          className={cn(
            'group w-full h-14 rounded-2xl font-semibold text-[#1F1F1F] bg-white',
            'flex items-center justify-center gap-3',
            'transition-all duration-200 ease-out',
            'hover:bg-white/90 hover:shadow-[0_0_30px_rgba(255,255,255,0.08)]',
            'active:scale-[0.97]'
          )}
        >
          <svg width="20" height="20" viewBox="0 0 18 18" className="transition-transform group-hover:scale-110">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.997 8.997 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
          </svg>
          Google로 시작하기
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

      {/* Bottom decorative line */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </div>
  );
}
