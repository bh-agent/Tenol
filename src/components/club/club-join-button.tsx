'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { joinPublicClub } from '@/lib/actions/clubs';
import { useToast } from '@/components/ui/toast-provider';
import { Check, Clock } from 'lucide-react';
import { useState } from 'react';

interface ClubJoinButtonProps {
  clubId: string;
  clubName?: string;
  /** 서버에서 조회한 초기 신청 상태 (모를 때는 'none'으로 두면 제출 시 서버가 중복을 걸러줌) */
  initialStatus?: 'none' | 'pending';
  /** 버튼 스타일 커스텀 (모집 카드 등에서 기존 톤 유지용) */
  variant?: 'primary' | 'outline';
  size?: 'sm' | 'md';
  fullWidth?: boolean;
  className?: string;
}

/**
 * 클럽 가입신청 버튼 + 신청서(자기소개) 모달.
 * 클럽 상세·모집 카드 등 어디서든 재사용 — 클럽 탐색과 동일한 신청 경험.
 */
export function ClubJoinButton({
  clubId,
  clubName,
  initialStatus = 'none',
  variant = 'primary',
  size = 'md',
  fullWidth = true,
  className,
}: ClubJoinButtonProps) {
  const toast = useToast();
  const [status, setStatus] = useState<'none' | 'pending'>(initialStatus);
  const [open, setOpen] = useState(false);
  const [introduction, setIntroduction] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await joinPublicClub(clubId, introduction.trim() || undefined);
      if (res?.error) {
        toast.error(res.error);
        // 이미 신청한 경우도 서버가 한국어로 알려주므로 그대로 노출
        if (res.error.includes('이미')) setStatus('pending');
        return;
      }
      setStatus('pending');
      setOpen(false);
      setIntroduction('');
      toast.success('가입 신청이 접수되었습니다. 관리자 승인을 기다려주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'pending') {
    return (
      <Button variant="secondary" size={size} fullWidth={fullWidth} disabled className={className}>
        <Clock className="w-4 h-4 mr-1.5" />
        가입 신청 대기 중
      </Button>
    );
  }

  return (
    <>
      <Button
        variant={variant === 'outline' ? 'outline' : 'primary'}
        size={size}
        fullWidth={fullWidth}
        onClick={() => setOpen(true)}
        className={className}
      >
        가입 신청
      </Button>

      <Modal
        isOpen={open}
        onClose={() => { setOpen(false); setIntroduction(''); }}
        title="가입 신청"
      >
        <div className="space-y-4">
          {clubName && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{clubName}</span> 클럽에 가입을 신청합니다.
            </p>
          )}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              자기소개 <span className="text-muted-foreground font-normal">(선택)</span>
            </label>
            <textarea
              value={introduction}
              onChange={(e) => setIntroduction(e.target.value)}
              placeholder="간단한 자기소개를 작성해주세요 (구력, 실력, 활동 가능 요일 등)"
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
            />
            <p className="text-xs text-muted-foreground text-right mt-1">{introduction.length}/500</p>
          </div>
          <Button onClick={handleSubmit} disabled={submitting} loading={submitting} fullWidth>
            <Check className="w-4 h-4 mr-1.5" />
            {submitting ? '신청 중...' : '가입 신청하기'}
          </Button>
        </div>
      </Modal>
    </>
  );
}
