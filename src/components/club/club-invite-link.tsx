'use client';

import { cn } from '@/lib/utils/cn';
import { Copy, Check, Share2, Link as LinkIcon } from 'lucide-react';
import { useState } from 'react';
import { useToast } from '@/components/ui/toast-provider';

const INVITE_BASE_URL = 'https://tenol-one.vercel.app/clubs/join';

export function ClubInviteLink({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { success } = useToast();

  const inviteLink = `${INVITE_BASE_URL}/${code}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = inviteLink;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    success('초대 링크가 복사되었습니다');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: '테놀 클럽 초대',
          text: '테놀 클럽에 가입하세요!',
          url: inviteLink,
        });
        return;
      } catch {
        // User cancelled or share failed - fall through to clipboard
      }
    }
    // Fallback to copy
    await handleCopyLink();
  };

  // Truncate link for display
  const displayLink = inviteLink.length > 38
    ? inviteLink.slice(0, 35) + '...'
    : inviteLink;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 bg-surface-elevated rounded-lg px-3 py-2.5 border border-border">
        <LinkIcon className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
        <span className="text-xs text-foreground/70 flex-1 truncate font-mono">
          {displayLink}
        </span>
        <button
          onClick={handleCopyLink}
          className={cn(
            'p-1.5 rounded-lg transition-all duration-200 cursor-pointer',
            copied
              ? 'bg-primary/10 scale-110'
              : 'hover:bg-surface-hover'
          )}
          aria-label="링크 복사"
        >
          {copied ? (
            <Check className="w-4 h-4 text-primary animate-fade-in" />
          ) : (
            <Copy className="w-4 h-4 text-muted-foreground" />
          )}
        </button>
        <button
          onClick={handleShare}
          className="p-1.5 rounded-lg hover:bg-surface-hover transition-all duration-200 cursor-pointer"
          aria-label="공유하기"
        >
          <Share2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
      <p className="text-[10px] text-muted-foreground/60 pl-1">
        초대 코드: <span className="font-mono tracking-wider">{code}</span>
      </p>
    </div>
  );
}
