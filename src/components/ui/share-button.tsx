'use client';

import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';
import { nativeShare } from '@/lib/utils/native-share';

interface ShareButtonProps {
  url: string;
  /** 공유 시트 제목(기기 UI용). 공유 본문에는 넣지 않는다 — 링크만 보낸다. */
  title: string;
  className?: string;
}

/**
 * 링크 공유 버튼.
 * - 네이티브 앱: Capacitor Share (Android WebView는 navigator.share 미지원)
 * - 모바일 웹: navigator.share
 * - 그 외: 클립보드 복사
 * 본문 텍스트 없이 URL만 보낸다. 받는 쪽(카톡 등)은 링크 미리보기(OG)로 제목·이미지를 보여준다.
 */
export function ShareButton({ url, title, className }: ShareButtonProps) {
  const { success } = useToast();

  const handleShare = async () => {
    const fullUrl = typeof window !== 'undefined'
      ? new URL(url, window.location.origin).toString()
      : url;

    if (await nativeShare({ title, url: fullUrl })) return;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ url: fullUrl });
        return;
      } catch {
        // User cancelled or share failed — fall through to clipboard
      }
    }

    try {
      await navigator.clipboard.writeText(fullUrl);
      success('링크가 복사되었습니다');
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = fullUrl;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      success('링크가 복사되었습니다');
    }
  };

  return (
    <button
      onClick={handleShare}
      className={className ?? 'p-2 rounded-full hover:bg-surface-elevated transition-colors cursor-pointer'}
      aria-label="공유하기"
    >
      <Share2 className="w-5 h-5 text-muted-foreground hover:text-primary-ink transition-colors" />
    </button>
  );
}
