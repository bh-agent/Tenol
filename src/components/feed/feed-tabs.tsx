'use client';

import { cn } from '@/lib/utils/cn';
import { PostCard } from '@/components/media/post-card';
import { SuggestedUsers } from '@/components/feed/suggested-users';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { UserPlus, Compass } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { UserProfile } from '@/types';

interface FeedTabsProps {
  followingFeed: any[];
}

export function FeedTabs({ followingFeed }: FeedTabsProps) {
  const [activeTab, setActiveTab] = useState<'following' | 'discover'>('following');
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [discoverFeed, setDiscoverFeed] = useState<any[] | null>(null);
  const [suggestedUsers, setSuggestedUsers] = useState<UserProfile[] | null>(null);
  const [discoverLoading, setDiscoverLoading] = useState(false);

  // Get current user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  // Indicator positioning
  useEffect(() => {
    const el = tabRefs.current.get(activeTab);
    const container = containerRef.current;
    if (el && container) {
      const containerRect = container.getBoundingClientRect();
      const elRect = el.getBoundingClientRect();
      setIndicatorStyle({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      });
    }
  }, [activeTab]);

  // Lazy load discover feed
  useEffect(() => {
    if (activeTab === 'discover' && discoverFeed === null && !discoverLoading) {
      setDiscoverLoading(true);
      fetch('/api/feed/discover')
        .then((r) => r.json())
        .then((data) => {
          setDiscoverFeed(data.feed ?? []);
          setSuggestedUsers(data.suggestedUsers ?? []);
        })
        .catch(() => {
          setDiscoverFeed([]);
          setSuggestedUsers([]);
        })
        .finally(() => setDiscoverLoading(false));
    }
  }, [activeTab, discoverFeed, discoverLoading]);

  const tabs = [
    { key: 'following' as const, label: '팔로잉' },
    { key: 'discover' as const, label: '탐색' },
  ];

  return (
    <div>
      {/* Tab bar */}
      <div ref={containerRef} className="relative flex border-b border-border sticky top-14 z-20 glass">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            ref={(el) => {
              if (el) tabRefs.current.set(tab.key, el);
            }}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 py-3 text-sm font-medium text-center transition-colors duration-200 relative cursor-pointer',
              activeTab === tab.key
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
        <div
          className="absolute bottom-0 h-0.5 bg-primary rounded-full transition-all duration-300 ease-out"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
          }}
        />
      </div>

      {/* Tab content */}
      <div className="animate-fade-in" key={activeTab}>
        {activeTab === 'following' ? (
          <FollowingContent feed={followingFeed} currentUserId={currentUserId} />
        ) : (
          <DiscoverContent
            feed={discoverFeed}
            suggestedUsers={suggestedUsers}
            loading={discoverLoading}
            currentUserId={currentUserId}
          />
        )}
      </div>
    </div>
  );
}

function FollowingContent({ feed, currentUserId }: { feed: any[]; currentUserId?: string }) {
  if (feed.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="아직 팔로우하는 사람이 없어요"
        description="다른 테니스 플레이어를 팔로우하고 피드를 채워보세요"
        actionLabel="사람 찾기"
        actionHref="/clubs/explore"
      />
    );
  }

  return (
    <div className="space-y-0">
      {feed.map((post: any, index: number) => (
        <div
          key={post.id}
          className="animate-fade-in"
          style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
        >
          <PostCard post={post} currentUserId={currentUserId} />
        </div>
      ))}
    </div>
  );
}

function DiscoverContent({
  feed,
  suggestedUsers,
  loading,
  currentUserId,
}: {
  feed: any[] | null;
  suggestedUsers: UserProfile[] | null;
  loading: boolean;
  currentUserId?: string;
}) {
  if (loading || feed === null) {
    return (
      <div>
        {/* Suggested users skeleton */}
        <div className="px-4 py-4">
          <Skeleton className="h-4 w-16 mb-3" />
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="flex-shrink-0 w-[130px]">
                <Skeleton className="h-[160px] w-full rounded-xl" />
              </div>
            ))}
          </div>
        </div>
        {/* Post skeletons */}
        {[0, 1].map((i) => (
          <div key={i} className="bg-[#141414] border-b border-[#2A2A2A]">
            <div className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="w-8 h-8 rounded-full" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="w-full aspect-[4/5]" />
            <div className="flex items-center gap-4 px-4 py-3">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-6 w-6 rounded-full" />
            </div>
            <div className="px-4 pb-4 space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Suggested users */}
      {suggestedUsers && suggestedUsers.length > 0 && (
        <SuggestedUsers users={suggestedUsers} />
      )}

      {/* Discover feed posts */}
      {feed.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="아직 탐색할 게시물이 없어요"
          description="더 많은 사람들이 활동하면 여기에 표시됩니다"
        />
      ) : (
        <div className="space-y-0">
          {feed.map((post: any, index: number) => (
            <div
              key={post.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
            >
              <PostCard post={post} currentUserId={currentUserId} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
