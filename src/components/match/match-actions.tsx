'use client';

import { Button } from '@/components/ui/button';
import { joinMatch, withdrawFromMatch, updateMatchStatus } from '@/lib/actions/matches';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface MatchActionsProps {
  matchId: string;
  clubId: string;
  canManage: boolean;
  status: string;
}

export function MatchActions({ matchId, clubId, canManage, status }: MatchActionsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    setLoading(true);
    try {
      await joinMatch(matchId);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    setLoading(true);
    try {
      await updateMatchStatus(matchId, newStatus);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'cancelled' || status === 'completed') return null;

  return (
    <div className="flex gap-2">
      <Button
        onClick={handleJoin}
        disabled={loading}
        fullWidth
        className="glow-primary-sm"
      >
        참가 신청
      </Button>

      {canManage && status === 'upcoming' && (
        <Button
          variant="secondary"
          onClick={() => handleStatusChange('in_progress')}
          disabled={loading}
        >
          시작
        </Button>
      )}

      {canManage && status === 'in_progress' && (
        <Button
          variant="secondary"
          onClick={() => handleStatusChange('completed')}
          disabled={loading}
        >
          종료
        </Button>
      )}
    </div>
  );
}
