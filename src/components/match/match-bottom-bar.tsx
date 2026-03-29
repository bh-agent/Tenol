'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { joinMatch, withdrawFromMatch } from '@/lib/actions/matches';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface MatchBottomBarProps {
  matchId: string;
  status: string;
  isParticipant: boolean;
  isFull: boolean;
}

export function MatchBottomBar({ matchId, status, isParticipant, isFull }: MatchBottomBarProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Only show for upcoming matches
  if (status !== 'upcoming' && status !== 'in_progress') return null;

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

  const handleWithdraw = async () => {
    if (!confirm('참가를 취소하시겠습니까?')) return;
    setLoading(true);
    try {
      await withdrawFromMatch(matchId);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-[calc(4.5rem+max(env(safe-area-inset-bottom),8px))] left-0 right-0 z-30 border-t border-border glass px-4 py-3">
      <div className="max-w-lg mx-auto">
        {isFull && !isParticipant ? (
          <Badge
            variant="default"
            className="w-full justify-center py-2.5 text-sm"
          >
            마감
          </Badge>
        ) : isParticipant ? (
          <Button
            variant="outline"
            fullWidth
            onClick={handleWithdraw}
            loading={loading}
          >
            참가 취소
          </Button>
        ) : (
          <Button
            variant="primary"
            fullWidth
            onClick={handleJoin}
            loading={loading}
            className="glow-primary-sm"
          >
            참가하기
          </Button>
        )}
      </div>
    </div>
  );
}
