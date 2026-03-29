import { cn } from '@/lib/utils/cn';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { type ReactNode } from 'react';

interface TopBarProps {
  title: string;
  backHref?: string;
  rightAction?: ReactNode;
  className?: string;
}

export function TopBar({ title, backHref, rightAction, className }: TopBarProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-30 glass border-b border-border/50 safe-top',
        className
      )}
    >
      <div className="max-w-lg mx-auto flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2 min-w-[40px]">
          {backHref && (
            <Link
              href={backHref}
              className="p-2.5 -ml-2.5 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
          )}
        </div>
        <h1 className="text-base font-semibold text-foreground truncate">
          {title}
        </h1>
        <div className="min-w-[40px] flex justify-end">
          {rightAction}
        </div>
      </div>
    </header>
  );
}
