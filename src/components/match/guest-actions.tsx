'use client';

import { Button } from '@/components/ui/button';
import { respondToGuest } from '@/lib/actions/matches';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function GuestActions({ participantId, matchId }: { participantId: string; matchId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleRespond = async (approved: boolean) => {
    setLoading(true);
    try {
      await respondToGuest(participantId, matchId, approved);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex gap-1.5">
      <Button
        size="sm"
        className="min-h-[44px] min-w-[44px]"
        onClick={() => handleRespond(true)}
        disabled={loading}
      >
        승인
      </Button>
      <Button
        size="sm"
        variant="destructive"
        className="min-h-[44px] min-w-[44px]"
        onClick={() => handleRespond(false)}
        disabled={loading}
      >
        거절
      </Button>
    </div>
  );
}
