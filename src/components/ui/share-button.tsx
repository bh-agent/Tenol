'use client';

import { Share2 } from 'lucide-react';
import { useToast } from '@/components/ui/toast-provider';

interface ShareButtonProps {
  url: string;
  title: string;
  text?: string;
  className?: string;
}

export function ShareButton({ url, title, text, className }: ShareButtonProps) {
  const { success } = useToast();

  const handleShare = async () => {
    const fullUrl = typeof window !== 'undefined'
      ? new URL(url, window.location.origin).toString()
      : url;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, text, url: fullUrl });
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
      <Share2 className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
    </button>
  );
}
