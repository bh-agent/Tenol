'use client';

import { Button } from '@/components/ui/button';
import { respondToGuest } from '@/lib/actions/matches';
import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ActionState = 'idle' | 'loading' | 'approved' | 'rejected';

export function GuestActions({ participantId, matchId }: { participantId: string; matchId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ActionState>('idle');

  const handleRespond = async (approved: boolean) => {
    if (!approved) {
      const confirmed = window.confirm('게스트 신청을 거절하시겠습니까?');
      if (!confirmed) return;
    }

    setState('loading');
    try {
      await respondToGuest(participantId, matchId, approved);
      setState(approved ? 'approved' : 'rejected');
      setTimeout(() => {
        router.refresh();
      }, 800);
    } catch (e) {
      setState('idle');
      alert(e instanceof Error ? e.message : '오류가 발생했습니다');
    }
  };

  if (state === 'approved') {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium text-primary animate-fade-in">
        <Check className="w-4 h-4" />
        승인됨
      </div>
    );
  }

  if (state === 'rejected') {
    return (
      <div className="flex items-center gap-1.5 text-sm font-medium text-destructive animate-fade-in">
        <X className="w-4 h-4" />
        거절됨
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <Button
        size="sm"
        variant="primary"
        onClick={() => handleRespond(true)}
        disabled={state === 'loading'}
        className="h-8 px-2.5"
      >
        <Check className="w-4 h-4" />
        <span className="hidden sm:inline ml-1">승인</span>
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => handleRespond(false)}
        disabled={state === 'loading'}
        className="h-8 px-2.5 text-muted-foreground hover:text-destructive"
      >
        <X className="w-4 h-4" />
        <span className="hidden sm:inline ml-1">거절</span>
      </Button>
    </div>
  );
}
