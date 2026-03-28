'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { deleteMatch } from '@/lib/actions/matches';
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

interface MatchManageButtonsProps {
  matchId: string;
  clubId: string;
  status: string;
}

export function MatchManageButtons({ matchId, status }: MatchManageButtonsProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canDelete = status === 'upcoming' || status === 'cancelled';

  if (!canDelete) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMatch(matchId);
    } catch (e) {
      setError(e instanceof Error ? e.message : '경기 삭제에 실패했습니다');
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        <Button
          variant="destructive"
          size="sm"
          fullWidth
          onClick={() => setShowDeleteModal(true)}
        >
          <Trash2 className="w-4 h-4" />
          경기 삭제
        </Button>
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => !deleting && setShowDeleteModal(false)}
        title="경기 삭제"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            이 경기를 삭제하시겠습니까? 모든 참가자, 대진표, 경기 결과가 삭제됩니다.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              fullWidth
              onClick={handleDelete}
              loading={deleting}
            >
              삭제
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
