'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function MatchError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // Report to server
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        category: 'client',
        message: error.message || 'Unknown error',
        errorName: error.name,
        errorStack: error.stack,
        errorDigest: error.digest,
        path: window.location.pathname,
      }),
    }).catch(() => {}); // Never block on logging
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">
        경기 정보를 불러올 수 없어요
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        경기 데이터를 가져오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => window.history.back()}>
          뒤로 가기
        </Button>
        <Button onClick={() => unstable_retry()}>
          다시 시도
        </Button>
      </div>
    </div>
  );
}
