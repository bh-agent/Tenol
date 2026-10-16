'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Smartphone, X } from 'lucide-react';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=app.tenol.club';
const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? '';
const DISMISS_KEY = 'tenol_open_in_app_dismissed';

/**
 * 공유 링크로 모바일 웹에 들어온 사용자에게 앱 설치를 안내하는 띠 배너.
 * - 앱이 설치돼 있으면 OS가 유니버설/앱 링크로 앱을 직접 열어주므로 이 배너는 보이지 않는다.
 * - 네이티브 앱 안·데스크톱에서는 표시하지 않는다.
 * - iOS는 NEXT_PUBLIC_APP_STORE_URL이 설정된 경우에만 표시.
 */
export function OpenInAppBanner() {
  const [storeUrl, setStoreUrl] = useState<string | null>(null);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    try {
      if (sessionStorage.getItem(DISMISS_KEY)) return;
    } catch {}
    const ua = navigator.userAgent;
    if (/Android/i.test(ua)) setStoreUrl(PLAY_STORE_URL);
    else if (/iPhone|iPad|iPod/i.test(ua) && APP_STORE_URL) setStoreUrl(APP_STORE_URL);
  }, []);

  if (!storeUrl) return null;

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {}
    setStoreUrl(null);
  };

  return (
    <div className="mx-4 mt-3 flex items-center gap-3 px-3 py-2.5 rounded-xl bg-primary/10 border border-primary/20 animate-fade-in">
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
        <Smartphone className="w-4 h-4 text-black" />
      </div>
      <p className="flex-1 text-xs text-foreground leading-snug">
        테놀 앱에서 보면 알림까지 받을 수 있어요
      </p>
      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-semibold text-black bg-primary rounded-lg px-3 py-1.5 flex-shrink-0 active:scale-[0.97] transition-transform"
      >
        앱 받기
      </a>
      <button type="button" onClick={dismiss} aria-label="닫기" className="p-1 -mr-1 text-muted-foreground cursor-pointer">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
