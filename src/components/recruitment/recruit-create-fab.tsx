'use client';

import Link from 'next/link';
import { Megaphone, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

interface RecruitCreateFabProps {
  clubs: { id: string; name: string }[];
}

/** 모집 탭에서 운영진이 바로 모집글을 쓸 수 있는 플로팅 버튼 */
export function RecruitCreateFab({ clubs }: RecruitCreateFabProps) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Escape 키로 바텀시트 닫기
  useEffect(() => {
    if (!sheetOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSheetOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sheetOpen]);

  if (clubs.length === 0) return null;

  const fabClassName =
    'fixed right-4 z-30 flex items-center gap-2 h-14 pl-4 pr-5 rounded-full bg-primary text-black font-semibold shadow-lg shadow-primary/30 active:scale-95 transition-transform';
  const fabStyle = { bottom: 'calc(88px + env(safe-area-inset-bottom))' };

  // 클럽이 하나면 바로 작성 페이지로 이동
  if (clubs.length === 1) {
    return (
      <Link
        href={`/clubs/${clubs[0].id}/recruit`}
        className={fabClassName}
        style={fabStyle}
        aria-label="모집글 작성"
      >
        <Megaphone className="w-5 h-5" />
        모집글 작성
      </Link>
    );
  }

  // 클럽이 여러 개면 바텀시트로 클럽 선택
  return (
    <>
      <button
        type="button"
        onClick={() => setSheetOpen(true)}
        className={fabClassName}
        style={fabStyle}
        aria-label="모집글 작성"
      >
        <Megaphone className="w-5 h-5" />
        모집글 작성
      </button>

      {sheetOpen && (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="모집글 작성할 클럽 선택">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setSheetOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-surface border-t border-border rounded-t-2xl p-4 pb-[max(env(safe-area-inset-bottom),16px)] animate-slide-up">
            <h2 className="text-base font-bold mb-3">어느 클럽의 모집글을 쓸까요?</h2>
            <div className="flex flex-col gap-2">
              {clubs.map((club) => (
                <Link
                  key={club.id}
                  href={`/clubs/${club.id}/recruit`}
                  className="flex items-center justify-between p-4 rounded-xl bg-surface-elevated border border-border active:scale-[0.98] transition-transform"
                  onClick={() => setSheetOpen(false)}
                >
                  <span className="font-medium">{club.name}</span>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
