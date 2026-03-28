'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { toggleFollow } from '@/lib/actions/follow';
import { cn } from '@/lib/utils/cn';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { UserProfile } from '@/types';

interface SuggestedUsersProps {
  users: UserProfile[];
}

export function SuggestedUsers({ users }: SuggestedUsersProps) {
  if (users.length === 0) return null;

  return (
    <div className="py-4 border-b border-border/50">
      {/* Header */}
      <div className="flex items-center justify-between px-4 mb-3">
        <span className="text-sm font-semibold text-muted-foreground">추천</span>
        <Link
          href="/clubs/explore"
          className="flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary-light transition-colors"
        >
          모두 보기
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto px-4 pb-1 scrollbar-hide snap-x snap-mandatory">
        {users.map((user) => (
          <SuggestedUserCard key={user.id} user={user} />
        ))}
      </div>
    </div>
  );
}

function SuggestedUserCard({ user }: { user: UserProfile }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleFollow = () => {
    startTransition(async () => {
      try {
        const result = await toggleFollow(user.id);
        setIsFollowing(result.isFollowing);
      } catch {
        // Silently fail
      }
    });
  };

  return (
    <div className="flex-shrink-0 w-[130px] snap-start">
      <div className="bg-surface-elevated border border-border/50 rounded-xl p-4 flex flex-col items-center gap-2.5 h-full">
        <Link href={`/profile/${user.id}`}>
          <Avatar
            src={user.avatar_url}
            alt={user.display_name}
            fallback={user.display_name}
            size="lg"
          />
        </Link>

        <div className="text-center min-w-0 w-full">
          <Link
            href={`/profile/${user.id}`}
            className="text-sm font-semibold text-foreground truncate block hover:text-primary transition-colors"
          >
            {user.display_name}
          </Link>
          {user.ntrp_level && (
            <Badge variant="primary" className="mt-1 text-[10px] px-2 py-0">
              NTRP {user.ntrp_level}
            </Badge>
          )}
        </div>

        <button
          onClick={handleFollow}
          disabled={isPending}
          className={cn(
            'w-full py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer',
            isFollowing
              ? 'bg-surface-hover text-muted-foreground border border-border hover:text-foreground'
              : 'bg-primary text-black hover:bg-primary-light hover:shadow-[0_0_16px_rgba(0,230,118,0.2)]',
            isPending && 'opacity-50 pointer-events-none'
          )}
        >
          {isFollowing ? '팔로잉' : '팔로우'}
        </button>
      </div>
    </div>
  );
}
