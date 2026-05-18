'use client';

import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import { blockUser, reportContent } from '@/lib/actions/moderation';
import { cn } from '@/lib/utils/cn';
import { Flag, ShieldOff } from 'lucide-react';
import { useState, useTransition } from 'react';

type ReportReason = 'spam' | 'inappropriate' | 'harassment' | 'fraud' | 'other';

const REASONS: { value: ReportReason; label: string; desc: string }[] = [
  { value: 'spam', label: '스팸/광고', desc: '반복적인 광고, 도배성 글' },
  { value: 'inappropriate', label: '부적절한 콘텐츠', desc: '욕설, 음란물, 폭력적 내용' },
  { value: 'harassment', label: '괴롭힘', desc: '특정인 비방, 위협' },
  { value: 'fraud', label: '사기/허위', desc: '거짓 정보, 사기 의심' },
  { value: 'other', label: '기타', desc: '기타 부적절한 사유' },
];

interface ReportBlockMenuProps {
  targetType: 'recruitment_post' | 'club' | 'user';
  targetId: string;
  targetUserId?: string | null;
  onDone?: () => void;
}

/**
 * 신고/차단 메뉴 (Apple Guideline 1.2 대응)
 *   - 모집글, 클럽, 사용자 콘텐츠에 부착
 *   - 본인 콘텐츠에는 표시하지 않음 (호출하는 쪽에서 분기)
 */
export function ReportBlockMenu({
  targetType,
  targetId,
  targetUserId,
  onDone,
}: ReportBlockMenuProps) {
  const [showReport, setShowReport] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [reporting, startReport] = useTransition();
  const [blocking, startBlock] = useTransition();
  const toast = useToast();

  const handleReport = () => {
    if (!reason) {
      toast.error('신고 사유를 선택해주세요');
      return;
    }
    startReport(async () => {
      try {
        await reportContent({
          targetType,
          targetId,
          reason,
          details: details.trim() || undefined,
        });
        toast.success('신고가 접수되었습니다. 24시간 내 검토됩니다.');
        setShowReport(false);
        setReason(null);
        setDetails('');
        onDone?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '신고 접수에 실패했습니다');
      }
    });
  };

  const handleBlock = () => {
    if (!targetUserId) {
      toast.error('차단할 사용자를 찾을 수 없습니다');
      return;
    }
    startBlock(async () => {
      try {
        await blockUser(targetUserId);
        toast.success('사용자를 차단했습니다. 해당 사용자의 콘텐츠가 더 이상 표시되지 않습니다.');
        onDone?.();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '차단에 실패했습니다');
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setShowReport(true)}
        className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
        role="menuitem"
      >
        <Flag className="w-5 h-5 text-destructive" />
        신고하기
      </button>

      {targetUserId && (
        <button
          onClick={handleBlock}
          disabled={blocking}
          className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-destructive hover:bg-surface-hover transition-colors"
          role="menuitem"
        >
          <ShieldOff className="w-5 h-5" />
          {blocking ? '차단 중...' : '사용자 차단'}
        </button>
      )}

      <Modal
        isOpen={showReport}
        onClose={() => {
          setShowReport(false);
          setReason(null);
          setDetails('');
        }}
        title="신고하기"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            부적절한 콘텐츠를 신고합니다. 신고는 익명으로 처리되며, 24시간 내 검토됩니다.
          </p>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground">
              신고 사유 <span className="text-destructive">*</span>
            </label>
            <div className="space-y-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReason(r.value)}
                  className={cn(
                    'w-full text-left rounded-xl border px-3 py-2.5 transition-colors',
                    reason === r.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-surface hover:border-primary/40'
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{r.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              상세 내용 (선택)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="추가 설명을 입력해주세요"
              className="w-full rounded-xl bg-surface border border-border px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none resize-none"
            />
            <p className="text-xs text-muted-foreground mt-1 text-right">
              {details.length} / 1000
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="secondary"
              fullWidth
              onClick={() => {
                setShowReport(false);
                setReason(null);
                setDetails('');
              }}
              disabled={reporting}
            >
              취소
            </Button>
            <Button
              fullWidth
              onClick={handleReport}
              loading={reporting}
              disabled={!reason}
            >
              신고 접수
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
