'use client';

import { MoreHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ReportBlockMenu } from '@/components/moderation/report-block-menu';

interface ReportMenuButtonProps {
  /** 신고 대상 종류 — 사용자 프로필이면 'user', 클럽이면 'club' */
  targetType: 'user' | 'club' | 'recruitment_post';
  targetId: string;
  /** 차단 가능한 대상(사용자)일 때만 전달. 클럽은 신고만 가능하므로 생략. */
  targetUserId?: string | null;
  /** 접근성 라벨 */
  label?: string;
  /** 다크 글래스 탑바 위에 올라가므로 기본 아이콘 색을 맞춤 */
  className?: string;
}

/**
 * 더보기(⋯) 버튼 + 하단 시트로 신고/차단 메뉴를 여는 재사용 컴포넌트.
 * Apple App Review Guideline 1.2(UGC): 사용자/클럽 콘텐츠를 신고·차단할 수 있어야 함.
 * recruitment-card.tsx의 하단 시트 패턴과 동일한 UX.
 */
export function ReportMenuButton({
  targetType,
  targetId,
  targetUserId,
  label = '더보기',
  className,
}: ReportMenuButtonProps) {
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(true)}
        className={
          className ??
          'p-2 rounded-full hover:bg-surface-elevated transition-colors text-muted-foreground hover:text-foreground'
        }
        aria-label={label}
        aria-haspopup="true"
        aria-expanded={showMenu}
      >
        <MoreHorizontal className="w-5 h-5" />
      </button>

      {showMenu &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-50 bg-black/40"
              onClick={() => setShowMenu(false)}
            />
            <div
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-elevated rounded-t-2xl border-t border-border shadow-xl animate-slide-up safe-bottom"
              role="menu"
              aria-label={label}
            >
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mt-3 mb-1" />
              <div className="py-1">
                <ReportBlockMenu
                  targetType={targetType}
                  targetId={targetId}
                  targetUserId={targetUserId}
                  onDone={() => {
                    setShowMenu(false);
                    // 차단/신고 후 화면 갱신(차단 시 프로필이 숨김 처리되도록)
                    router.refresh();
                  }}
                />
              </div>
            </div>
          </>,
          document.body,
        )}
    </div>
  );
}
