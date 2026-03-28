'use client';

import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils/cn';

export default function LoginPage() {
  const supabase = createClient();

  const handleKakaoLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
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
        {/* Tennis ball SVG element */}
        <div className="relative mb-8">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center glow-primary">
            <svg
              width="56"
              height="56"
              viewBox="0 0 56 56"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle cx="28" cy="28" r="26" stroke="#00E676" strokeWidth="2" opacity="0.6" />
              <path
                d="M8 28C8 28 18 18 28 18C38 18 48 28 48 28"
                stroke="#00E676"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.4"
              />
              <path
                d="M8 28C8 28 18 38 28 38C38 38 48 28 48 28"
                stroke="#00E676"
                strokeWidth="2"
                strokeLinecap="round"
                opacity="0.4"
              />
              <circle cx="28" cy="28" r="6" fill="#00E676" opacity="0.15" />
              <circle cx="28" cy="28" r="3" fill="#00E676" opacity="0.5" />
            </svg>
          </div>
          {/* Floating particles */}
          <div className="absolute -top-2 -right-2 w-2 h-2 rounded-full bg-primary/40 animate-pulse" />
          <div className="absolute -bottom-1 -left-3 w-1.5 h-1.5 rounded-full bg-primary/30 animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* App name with gradient */}
        <h1 className="text-5xl font-bold text-gradient mb-3 tracking-tight">
          테놀
        </h1>

        {/* Tagline */}
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
        {/* Kakao Login */}
        <button
          onClick={handleKakaoLogin}
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
          onClick={handleGoogleLogin}
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
          <span className="text-muted-foreground underline underline-offset-2 cursor-pointer">이용약관</span> 및{' '}
          <span className="text-muted-foreground underline underline-offset-2 cursor-pointer">개인정보 처리방침</span>에
          동의하게 됩니다.
        </p>
      </div>

      {/* Bottom decorative line */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-0.5 rounded-full bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    </div>
  );
}
