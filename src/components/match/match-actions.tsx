'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import { updateMatchStatus } from '@/lib/actions/matches';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface MatchActionsProps {
  matchId: string;
  clubId: string;
  canManage: boolean;
  status: string;
}

export function MatchActions({ matchId, canManage, status }: MatchActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      await updateMatchStatus(matchId, newStatus);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (!canManage) return null;
  if (status === 'cancelled' || status === 'completed') return null;

  return (
    <>
      <div className="flex gap-2">
        {status === 'upcoming' && (
          <Button
            variant="secondary"
            onClick={() => handleStatusChange('in_progress')}
            disabled={loading}
            fullWidth
          >
            경기 시작
          </Button>
        )}

        {status === 'in_progress' && (
          <Button
            variant="secondary"
            onClick={() => handleStatusChange('completed')}
            disabled={loading}
            fullWidth
          >
            경기 종료
          </Button>
        )}

        {(status === 'upcoming' || status === 'in_progress') && (
          <Button
            variant="outline"
            onClick={() => {
              setConfirmAction({
                message: '경기를 취소하시겠습니까?',
                onConfirm: () => handleStatusChange('cancelled'),
              });
            }}
            disabled={loading}
          >
            취소
          </Button>
        )}
      </div>

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
    </>
  );
}
