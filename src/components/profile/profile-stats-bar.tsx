'use client';

import { useState } from 'react';
import { FollowListModal } from './follow-list-modal';

interface ProfileStatsBarProps {
  userId: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
}

export function ProfileStatsBar({
  userId,
  postCount,
  followerCount: initialFollowerCount,
  followingCount,
}: ProfileStatsBarProps) {
  const [modalType, setModalType] = useState<'followers' | 'following' | null>(null);
  const [followerCount, setFollowerCount] = useState(initialFollowerCount);

  return (
    <>
      <div className="flex items-center justify-center py-3 border-y border-border">
        {/* Posts */}
        <div className="flex-1 text-center">
          <p className="text-lg font-bold text-foreground">{postCount}</p>
          <p className="text-xs text-muted-foreground">게시물</p>
        </div>

        <div className="w-px h-10 bg-border" />

        {/* Followers */}
        <button
          onClick={() => setModalType('followers')}
          className="flex-1 text-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          <p className="text-lg font-bold text-foreground">{followerCount}</p>
          <p className="text-xs text-muted-foreground">팔로워</p>
        </button>

        <div className="w-px h-10 bg-border" />

        {/* Following */}
        <button
          onClick={() => setModalType('following')}
          className="flex-1 text-center cursor-pointer hover:opacity-80 transition-opacity"
        >
          <p className="text-lg font-bold text-foreground">{followingCount}</p>
          <p className="text-xs text-muted-foreground">팔로잉</p>
        </button>
      </div>

      {/* Follow List Modal */}
      <FollowListModal
        userId={userId}
        type={modalType ?? 'followers'}
        isOpen={modalType !== null}
        onClose={() => setModalType(null)}
        count={modalType === 'following' ? followingCount : followerCount}
      />
    </>
  );
}
