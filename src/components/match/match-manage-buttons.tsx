'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { deleteMatch } from '@/lib/actions/matches';
import { isRedirectError } from '@/lib/utils/redirect-error';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface MatchManageButtonsProps {
  matchId: string;
  clubId: string;
  status: string;
}

export function MatchManageButtons({ matchId, clubId, status }: MatchManageButtonsProps) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = status === 'upcoming';
  const canDelete = status === 'upcoming' || status === 'cancelled';

  if (!canEdit && !canDelete) return null;

  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await deleteMatch(matchId);
    } catch (e) {
      // onClick 핸들러는 transition 밖이라 redirect()를 Next가 처리하지 못함 → 직접 이동
      if (isRedirectError(e)) {
        router.replace(`/clubs/${clubId}`);
        return;
      }
      setError(e instanceof Error ? e.message : '경기 삭제에 실패했습니다');
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex gap-2">
        {canEdit && (
          <Link href={`/clubs/${clubId}/matches/${matchId}/edit`} className="flex-1">
            <Button variant="outline" size="sm" fullWidth>
              <Pencil className="w-4 h-4" />
              수정
            </Button>
          </Link>
        )}
        {canDelete && (
          <Button
            variant="destructive"
            size="sm"
            className="flex-1"
            onClick={() => setShowDeleteModal(true)}
          >
            <Trash2 className="w-4 h-4" />
            삭제
          </Button>
        )}
      </div>

      {/* 진행 중에도 닫기 허용 — 요청이 느릴 때 화면 전체가 잠기는 문제 방지 (작업은 서버에서 계속됨) */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
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
