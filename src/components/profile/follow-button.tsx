'use client';

import { cn } from '@/lib/utils/cn';
import { toggleFollow } from '@/lib/actions/follow';
import { Check } from 'lucide-react';
import { useState, useTransition } from 'react';

interface FollowButtonProps {
  targetUserId: string;
  isFollowing: boolean;
  size?: 'sm' | 'md';
  onFollowChange?: (isFollowing: boolean, followerCount: number) => void;
}

export function FollowButton({
  targetUserId,
  isFollowing: initialIsFollowing,
  size = 'sm',
  onFollowChange,
}: FollowButtonProps) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [isHovered, setIsHovered] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    // Optimistic update
    const newIsFollowing = !isFollowing;
    setIsFollowing(newIsFollowing);

    startTransition(async () => {
      try {
        const result = await toggleFollow(targetUserId);
        setIsFollowing(result.isFollowing);
        onFollowChange?.(result.isFollowing, result.followerCount);
      } catch {
        // Revert on error
        setIsFollowing(!newIsFollowing);
      }
    });
  };

  const sizeClasses = {
    sm: 'h-8 px-4 text-sm',
    md: 'h-9 px-5 text-sm',
  };

  if (isFollowing) {
    return (
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        disabled={isPending}
        className={cn(
          'relative inline-flex items-center justify-center font-medium rounded-lg',
          'transition-all duration-200 ease-out',
          'active:scale-95 cursor-pointer',
          'disabled:opacity-40 disabled:pointer-events-none',
          sizeClasses[size],
          isHovered
            ? 'border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/15'
            : 'border border-border bg-surface-elevated text-muted-foreground'
        )}
      >
        {isHovered ? (
          <span>팔로우 취소</span>
        ) : (
          <span className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" />
            팔로잉
          </span>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        'relative inline-flex items-center justify-center font-semibold rounded-lg',
        'transition-all duration-200 ease-out',
        'active:scale-95 cursor-pointer',
        'disabled:opacity-40 disabled:pointer-events-none',
        'bg-primary text-black hover:bg-primary-light hover:shadow-[0_0_16px_rgba(0,230,118,0.2)]',
        sizeClasses[size]
      )}
    >
      팔로우
    </button>
  );
}
