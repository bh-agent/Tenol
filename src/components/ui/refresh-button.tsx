'use client';

import { cn } from '@/lib/utils/cn';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

interface RefreshButtonProps {
  className?: string;
}

export function RefreshButton({ className }: RefreshButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleRefresh}
      disabled={isPending}
      className={cn(
        'p-2 rounded-full hover:bg-surface-elevated transition-colors',
        className
      )}
      aria-label="새로고침"
    >
      <RefreshCw
        className={cn(
          'w-5 h-5 text-muted-foreground hover:text-primary transition-colors',
          isPending && 'animate-spin text-primary'
        )}
      />
    </button>
  );
}
