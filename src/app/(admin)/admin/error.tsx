'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';

export default function AdminError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">문제가 발생했어요</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        관리자 페이지를 불러오는 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.
      </p>
      <div className="flex gap-3">
        <Link href="/profile">
          <Button variant="outline">돌아가기</Button>
        </Link>
        <Button onClick={() => unstable_retry()}>다시 시도</Button>
      </div>
    </div>
  );
}
