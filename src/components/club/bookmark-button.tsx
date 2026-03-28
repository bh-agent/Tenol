'use client';

import { Bookmark } from 'lucide-react';
import { toggleBookmark } from '@/lib/actions/bookmarks';
import { useState, useTransition } from 'react';

interface BookmarkButtonProps {
  clubId: string;
  initialBookmarked: boolean;
  /** 'icon' = icon only (for cards), 'button' = with text */
  variant?: 'icon' | 'button';
}

export function BookmarkButton({
  clubId,
  initialBookmarked,
  variant = 'icon',
}: BookmarkButtonProps) {
  const [isBookmarked, setIsBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    // Optimistic update
    setIsBookmarked((prev) => !prev);

    startTransition(async () => {
      try {
        const result = await toggleBookmark(clubId);
        setIsBookmarked(result.isBookmarked);
      } catch {
        // Revert on error
        setIsBookmarked((prev) => !prev);
      }
    });
  }

  if (variant === 'button') {
    return (
      <button
        onClick={handleToggle}
        disabled={isPending}
        className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
          transition-all duration-200 active:scale-[0.95]
          ${isBookmarked
            ? 'bg-yellow-500/15 text-yellow-500 border border-yellow-500/30'
            : 'bg-surface-elevated text-muted-foreground border border-border hover:border-yellow-500/30 hover:text-yellow-500'
          }
        `}
      >
        <Bookmark
          className={`w-4 h-4 transition-all duration-200 ${isBookmarked ? 'fill-yellow-500' : ''}`}
        />
        {isBookmarked ? '즐겨찾기됨' : '즐겨찾기'}
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        handleToggle();
      }}
      disabled={isPending}
      className="p-1.5 rounded-full transition-all duration-200 active:scale-[0.90] hover:bg-surface-elevated"
      aria-label={isBookmarked ? '즐겨찾기 해제' : '즐겨찾기 추가'}
    >
      <Bookmark
        className={`w-5 h-5 transition-all duration-200 ${
          isBookmarked
            ? 'fill-yellow-500 text-yellow-500'
            : 'text-muted-foreground hover:text-yellow-500'
        }`}
      />
    </button>
  );
}
