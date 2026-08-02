'use client';

import { cn } from '@/lib/utils/cn';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';

export function ClubInviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2 bg-surface-elevated rounded-lg px-3 py-2 border border-border">
      <span className="text-xs text-muted-foreground">초대 코드</span>
      <span className="font-mono font-semibold text-sm flex-1 text-primary tracking-wider">
        {code}
      </span>
      <button
        onClick={handleCopy}
        aria-label="초대 코드 복사"
        className={cn(
          'p-1.5 rounded-lg transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
          copied
            ? 'bg-primary/10 scale-110'
            : 'hover:bg-surface-hover'
        )}
      >
        {copied ? (
          <Check className="w-4 h-4 text-primary animate-fade-in" />
        ) : (
          <Copy className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    </div>
  );
}
