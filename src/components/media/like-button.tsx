'use client';

import { cn } from '@/lib/utils/cn';
import { toggleLike } from '@/lib/actions/social';
import { Heart } from 'lucide-react';
import { useState, useTransition } from 'react';

interface LikeButtonProps {
  mediaId: string;
  initialLiked: boolean;
  initialCount: number;
  showCount?: boolean;
  size?: number;
}

export function LikeButton({
  mediaId,
  initialLiked,
  initialCount,
  showCount = true,
  size = 24,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [animating, setAnimating] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    // Optimistic update
    const newLiked = !liked;
    setLiked(newLiked);
    setCount((c) => (newLiked ? c + 1 : Math.max(0, c - 1)));

    if (newLiked) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 300);
    }

    startTransition(async () => {
      try {
        const result = await toggleLike(mediaId);
        setLiked(result.liked);
        setCount(result.likeCount);
      } catch {
        // Revert on error
        setLiked(!newLiked);
        setCount((c) => (newLiked ? Math.max(0, c - 1) : c + 1));
      }
    });
  };

  return (
    <div className="flex flex-col items-start">
      <button
        onClick={handleToggle}
        disabled={isPending}
        className="group relative p-0 bg-transparent border-none cursor-pointer disabled:cursor-default"
        aria-label={liked ? '좋아요 취소' : '좋아요'}
      >
        <Heart
          size={size}
          className={cn(
            'transition-all duration-200 ease-out',
            liked
              ? 'fill-destructive text-destructive'
              : 'fill-transparent text-muted-foreground hover:text-foreground',
            animating && 'scale-[1.2]'
          )}
          strokeWidth={liked ? 0 : 1.5}
        />
      </button>
      {showCount && count > 0 && (
        <span className="text-sm font-semibold text-foreground mt-1">
          좋아요 {count.toLocaleString()}개
        </span>
      )}
    </div>
  );
}
