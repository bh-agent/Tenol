'use client';

import { cn } from '@/lib/utils/cn';
import { toggleLike } from '@/lib/actions/social';
import { Heart } from 'lucide-react';
import { useRef, useState, useTransition } from 'react';

interface LikeButtonProps {
  mediaId: string;
  initialLiked: boolean;
  initialCount: number;
  showCount?: boolean;
  size?: number;
  onLikeChange?: (liked: boolean, count: number) => void;
}

export function LikeButton({
  mediaId,
  initialLiked,
  initialCount,
  showCount = true,
  size = 24,
  onLikeChange,
}: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [animating, setAnimating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const pendingRef = useRef(false);

  // Sync with parent state when props change (e.g. double-tap like from PostCard)
  const prevLikedRef = useRef(initialLiked);
  const prevCountRef = useRef(initialCount);
  if (prevLikedRef.current !== initialLiked || prevCountRef.current !== initialCount) {
    prevLikedRef.current = initialLiked;
    prevCountRef.current = initialCount;
    setLiked(initialLiked);
    setCount(initialCount);
  }

  const handleToggle = () => {
    // Prevent rapid double-clicks before useTransition marks isPending
    if (pendingRef.current) return;
    pendingRef.current = true;

    // Capture pre-toggle state for revert
    const prevLiked = liked;
    const prevCount = count;

    // Optimistic update
    const newLiked = !prevLiked;
    const newCount = newLiked ? prevCount + 1 : Math.max(0, prevCount - 1);
    setLiked(newLiked);
    setCount(newCount);
    onLikeChange?.(newLiked, newCount);

    if (newLiked) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 300);
    }

    startTransition(async () => {
      try {
        const result = await toggleLike(mediaId);
        setLiked(result.liked);
        setCount(result.likeCount);
        onLikeChange?.(result.liked, result.likeCount);
      } catch {
        // Revert to pre-toggle state on error
        setLiked(prevLiked);
        setCount(prevCount);
        onLikeChange?.(prevLiked, prevCount);
      } finally {
        pendingRef.current = false;
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
