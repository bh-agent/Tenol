'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import { joinMatch, withdrawFromMatch, applyAsGuest, toggleRegistration, leaveWaitlist } from '@/lib/actions/matches';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react';

interface MatchBottomBarProps {
  matchId: string;
  status: string;
  isParticipant: boolean;
  registrationClosed: boolean;
  isMember?: boolean;
  isPendingGuest?: boolean;
  isWaitlisted?: boolean;
  waitlistPosition?: number;
  isFull?: boolean;
  allowGuests?: boolean;
  canManage?: boolean;
  userProfile?: {
    display_name: string;
    ntrp_level: number | null;
    tennis_start_date: string | null;
  } | null;
}

function formatTennisCareer(startDate: string | null) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (totalMonths < 1) return '시작한 지 얼마 안 됨';
  if (totalMonths < 12) return `${totalMonths}개월`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years}년 ${months}개월` : `${years}년`;
}

export function MatchBottomBar({
  matchId,
  status,
  isParticipant,
  registrationClosed,
  isMember = true,
  isPendingGuest = false,
  isWaitlisted = false,
  waitlistPosition = 0,
  isFull = false,
  allowGuests = true,
  canManage = false,
  userProfile,
}: MatchBottomBarProps) {
  const router = useRouter();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [introduction, setIntroduction] = useState('');
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Only show for upcoming matches
  if (status !== 'upcoming' && status !== 'in_progress') return null;

  const handleJoin = async () => {
    setLoading(true);
    try {
      const res = await joinMatch(matchId);
      if (res?.error) { toast.error(res.error); return; }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestApply = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const res = await applyAsGuest(matchId, userProfile.display_name, null, introduction || null);
      if (res?.error) { toast.error(res.error); return; }
      setShowGuestModal(false);
      setIntroduction('');
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinWaitlist = async () => {
    setLoading(true);
    try {
      const res = await joinMatch(matchId);
      if (res?.error) { toast.error(res.error); return; }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveWaitlist = async () => {
    setConfirmAction({
      message: '대기를 취소하시겠습니까?',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await leaveWaitlist(matchId);
          if (res?.error) { toast.error(res.error); return; }
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleWithdraw = async () => {
    setConfirmAction({
      message: '참가를 취소하시겠습니까?',
      onConfirm: async () => {
        setLoading(true);
        try {
          const res = await withdrawFromMatch(matchId);
          if (res?.error) { toast.error(res.error); return; }
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
        } finally {
          setLoading(false);
        }
      },
    });
  };

  const handleToggleRegistration = async () => {
    setLoading(true);
    try {
      const res = await toggleRegistration(matchId);
      if ('error' in res) { toast.error(res.error); return; }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  const career = userProfile?.tennis_start_date ? formatTennisCareer(userProfile.tennis_start_date) : null;

  return (
    <>
      <div className="hide-on-keyboard fixed bottom-[calc(4.5rem+max(env(safe-area-inset-bottom),8px))] left-0 right-0 z-30 border-t border-border glass px-4 py-3">
        <div className="max-w-lg mx-auto flex gap-2">
          {/* Main action area */}
          <div className="flex-1">
            {registrationClosed && !isParticipant && !isPendingGuest && !isWaitlisted ? (
              <Badge
                variant="default"
                className="w-full justify-center py-2.5 text-sm"
              >
                모집 마감
              </Badge>
            ) : isWaitlisted ? (
              <Button
                variant="outline"
                fullWidth
                onClick={handleLeaveWaitlist}
                loading={loading}
              >
                대기 취소 (대기 {waitlistPosition}번째)
              </Button>
            ) : isPendingGuest ? (
              <Badge
                variant="warning"
                className="w-full justify-center py-2.5 text-sm"
              >
                게스트 승인 대기중
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
            ) : isMember && isFull ? (
              <Button
                variant="secondary"
                fullWidth
                onClick={handleJoinWaitlist}
                loading={loading}
              >
                대기자로 참가
              </Button>
            ) : isMember ? (
              <Button
                variant="primary"
                fullWidth
                onClick={handleJoin}
                loading={loading}
                className="glow-primary-sm"
              >
                참가하기
              </Button>
            ) : allowGuests ? (
              <Button
                variant="primary"
                fullWidth
                onClick={() => setShowGuestModal(true)}
                className="glow-primary-sm"
              >
                게스트 참가 신청
              </Button>
            ) : (
              <Badge
                variant="default"
                className="w-full justify-center py-2.5 text-sm"
              >
                클럽 멤버만 참가 가능
              </Badge>
            )}
          </div>

          {/* Admin: registration toggle button */}
          {canManage && (
            <Button
              variant={registrationClosed ? 'primary' : 'outline'}
              onClick={handleToggleRegistration}
              loading={loading}
              className="shrink-0 px-3"
            >
              {registrationClosed ? (
                <LockKeyholeOpen className="w-4 h-4" />
              ) : (
                <LockKeyhole className="w-4 h-4" />
              )}
              <span className="ml-1.5 text-xs">
                {registrationClosed ? '재오픈' : '마감'}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Confirm Modal */}
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

      {/* Guest Application Modal */}
      <Modal
        isOpen={showGuestModal}
        onClose={() => { setShowGuestModal(false); setIntroduction(''); }}
        title="게스트 참가 신청"
      >
        <div className="space-y-4">
          {/* Profile info */}
          {userProfile && (userProfile.ntrp_level || career) && (
            <div className="flex flex-wrap gap-2">
              {userProfile.ntrp_level && (
                <Badge variant="primary">NTRP {userProfile.ntrp_level}</Badge>
              )}
              {career && (
                <Badge variant="outline">구력 {career}</Badge>
              )}
            </div>
          )}

          {/* Introduction textarea */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              자기소개 <span className="text-muted-foreground font-normal">(선택)</span>
            </label>
            <textarea
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              placeholder="간단한 자기소개를 작성해주세요"
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {introduction.length}/500
            </p>
          </div>

          <Button
            fullWidth
            onClick={handleGuestApply}
            loading={loading}
          >
            신청하기
          </Button>
        </div>
      </Modal>
    </>
  );
}
