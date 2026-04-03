'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import { respondToGuest } from '@/lib/actions/matches';
import { Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ActionState = 'idle' | 'loading' | 'approved' | 'rejected';

export function GuestActions({ participantId, matchId }: { participantId: string; matchId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<ActionState>('idle');
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const doRespond = async (approved: boolean) => {
    setState('loading');
    try {
      await respondToGuest(participantId, matchId, approved);
      setState(approved ? 'approved' : 'rejected');
      setTimeout(() => {
        router.refresh();
      }, 800);
    } catch (e) {
      setState('idle');
      toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
    }
  };

  const handleRespond = async (approved: boolean) => {
    if (!approved) {
      setConfirmAction({
        message: '게스트 신청을 거절하시겠습니까?',
        onConfirm: () => doRespond(false),
      });
      return;
    }
    doRespond(true);
  };

  const confirmModal = (
    <Modal
      isOpen={!!confirmAction}
      onClose={() => setConfirmAction(null)}
      title="확인"
    >
      <div className="space-y-4">
        <p className="text-sm text-foreground">{confirmAction?.message}</p>
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setConfirmAction(null)}>
            취소
          </Button>
          <Button
            fullWidth
            onClick={() => {
              confirmAction?.onConfirm();
              setConfirmAction(null);
            }}
          >
            확인
          </Button>
        </div>
      </div>
    </Modal>
  );

  if (state === 'approved') {
    return (
      <>
        <div className="flex items-center gap-1.5 text-sm font-medium text-primary animate-fade-in">
          <Check className="w-4 h-4" />
          승인됨
        </div>
        {confirmModal}
      </>
    );
  }

  if (state === 'rejected') {
    return (
      <>
        <div className="flex items-center gap-1.5 text-sm font-medium text-destructive animate-fade-in">
          <X className="w-4 h-4" />
          거절됨
        </div>
        {confirmModal}
      </>
    );
  }

  return (
    <>
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
      {confirmModal}
    </>
  );
}
