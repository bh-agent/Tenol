'use client';

import { Button } from '@/components/ui/button';
import { joinClubByCode } from '@/lib/actions/clubs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function JoinByLinkForm({ inviteCode }: { inviteCode: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleJoin = async () => {
    setLoading(true);
    setError('');
    try {
      await joinClubByCode(inviteCode);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-3 space-y-2">
        <p className="text-sm font-medium text-primary">
          가입 신청이 완료되었습니다!
        </p>
        <p className="text-xs text-muted-foreground">
          클럽 관리자가 승인하면 알림을 보내드립니다.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push('/clubs')}
          className="mt-2"
        >
          내 클럽 목록으로
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pt-1">
      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
      <Button
        fullWidth
        size="lg"
        onClick={handleJoin}
        loading={loading}
      >
        가입 신청
      </Button>
    </div>
  );
}
