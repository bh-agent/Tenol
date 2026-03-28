'use client';

import { Celebration } from '@/components/ui/celebration';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function ClubCreatedCelebration() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const show = searchParams.get('created') === 'true';

  const handleComplete = useCallback(() => {
    // Remove the query param without a full reload
    router.replace(window.location.pathname, { scroll: false });
  }, [router]);

  return (
    <Celebration
      show={show}
      title="클럽이 생성되었습니다!"
      description="새로운 테니스 클럽을 시작해보세요"
      onComplete={handleComplete}
    />
  );
}
