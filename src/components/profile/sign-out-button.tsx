'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { signOut } from '@/lib/actions/profile';
import { LogOut, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SignOutButton() {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || '계정 삭제에 실패했습니다');
      }
      router.push('/login');
    } catch (e) {
      alert(e instanceof Error ? e.message : '계정 삭제에 실패했습니다. 다시 시도해주세요.');
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="space-y-2">
        <Button
          variant="ghost"
          fullWidth
          onClick={handleSignOut}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="w-4 h-4 mr-2" />
          로그아웃
        </Button>

        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full text-center text-xs text-muted-foreground hover:text-destructive transition-colors py-2"
        >
          <span className="flex items-center justify-center gap-1.5">
            <Trash2 className="w-3 h-3" />
            계정 삭제
          </span>
        </button>
      </div>

      {/* 계정 삭제 확인 모달 */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="계정 삭제">
        <div className="space-y-4">
          <div className="rounded-xl bg-destructive/10 border border-destructive/20 p-4">
            <p className="text-sm text-foreground leading-relaxed">
              정말 계정을 삭제하시겠습니까?
            </p>
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
              모든 데이터가 삭제되며 복구할 수 없습니다.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowDeleteModal(false)}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              fullWidth
              loading={deleting}
              onClick={handleDeleteAccount}
            >
              삭제하기
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
