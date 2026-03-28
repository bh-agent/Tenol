'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'tenol-install-dismissed';
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show on mobile
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Check if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Check if previously dismissed
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setVisible(false);
    }
    setDeferredPrompt(null);
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] safe-bottom animate-slide-up">
      <div className="glass border-t border-border mx-3 mb-3 rounded-2xl px-4 py-3 flex items-center gap-3 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
        <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center flex-shrink-0">
          <span className="text-black font-bold text-lg">T</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-[15px] text-foreground">
            홈 화면에 추가
          </p>
          <p className="text-[13px] text-muted-foreground mt-0.5">
            테놀을 앱처럼 사용하세요
          </p>
        </div>
        <button
          onClick={handleInstall}
          className="flex items-center gap-1.5 bg-primary text-black rounded-xl px-4 py-2 text-sm font-semibold flex-shrink-0 hover:bg-primary-light transition-colors active:scale-[0.97]"
        >
          <Download className="w-4 h-4" />
          설치
        </button>
        <button
          onClick={handleDismiss}
          aria-label="닫기"
          className="p-1 rounded-full hover:bg-surface-elevated transition-colors flex-shrink-0"
        >
          <X className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
