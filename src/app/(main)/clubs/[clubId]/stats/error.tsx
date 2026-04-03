'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function StatsError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  const params = useParams();
  const clubId = params.clubId as string;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center animate-fade-in">
      <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-5">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-2">
        통계를 불러올 수 없어요
      </h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-xs">
        통계 데이터를 가져오는 중 문제가 발생했습니다. 다시 시도해주세요.
      </p>
      <div className="flex gap-3">
        <Link href={`/clubs/${clubId}`}>
          <Button variant="outline">클럽으로</Button>
        </Link>
        <Button onClick={() => unstable_retry()}>다시 시도</Button>
      </div>
    </div>
  );
}
