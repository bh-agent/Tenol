'use client';

import { PostCard } from '@/components/media/post-card';
import { SuggestedUsers } from '@/components/feed/suggested-users';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { createClient } from '@/lib/supabase/client';
import { Compass } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FeedPost, FeedSource } from '@/lib/queries/feed';
interface SuggestedUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  bio?: string | null;
  ntrp_level?: number | null;
  is_following?: boolean;
}

interface FeedListProps {
  initialFeed: FeedPost[];
  suggestedUsers: SuggestedUser[];
}

const SOURCE_LABELS: Partial<Record<FeedSource, string>> = {
  discovery: '추천',
  bookmarked_club: '즐겨찾기 클럽',
  my_club: '내 클럽',
};

export function FeedList({ initialFeed, suggestedUsers }: FeedListProps) {
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [feed, setFeed] = useState<FeedPost[]>(initialFeed);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(initialFeed.length >= 20);
  const loaderRef = useRef<HTMLDivElement>(null);

  // Get current user
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id);
    });
  }, []);

  // Infinite scroll
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`/api/feed/more?offset=${feed.length}&limit=20`);
      const data = await res.json();
      const newPosts: FeedPost[] = data.feed ?? [];
      if (newPosts.length === 0) {
        setHasMore(false);
      } else {
        // Deduplicate
        const existingIds = new Set(feed.map((p) => p.id));
        const unique = newPosts.filter((p) => !existingIds.has(p.id));
        setFeed((prev) => [...prev, ...unique]);
        if (newPosts.length < 20) setHasMore(false);
      }
    } catch {
      // Silently fail
    } finally {
      setLoadingMore(false);
    }
  }, [feed, loadingMore, hasMore]);

  // Intersection observer for infinite scroll
  useEffect(() => {
    const el = loaderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: '200px' }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  if (feed.length === 0 && suggestedUsers.length === 0) {
    return (
      <EmptyState
        icon={Compass}
        title="아직 게시물이 없어요"
        description="다른 테니스 플레이어를 팔로우하고 피드를 채워보세요"
        actionLabel="사람 찾기"
        actionHref="/clubs/explore"
      />
    );
  }

  return (
    <div>
      {/* Suggested users strip */}
      {suggestedUsers.length > 0 && (
        <SuggestedUsers users={suggestedUsers} />
      )}

      {/* Feed posts */}
      {feed.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="아직 게시물이 없어요"
          description="다른 테니스 플레이어를 팔로우하고 피드를 채워보세요"
          actionLabel="사람 찾기"
          actionHref="/clubs/explore"
        />
      ) : (
        <div className="space-y-0">
          {feed.map((post, index) => (
            <div
              key={post.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(index * 60, 300)}ms` }}
            >
              {/* Subtle source label for non-following posts */}
              {SOURCE_LABELS[post.feed_source] && (
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[11px] font-medium text-muted-foreground tracking-wide">
                    {SOURCE_LABELS[post.feed_source]}
                  </span>
                </div>
              )}
              <PostCard post={post} currentUserId={currentUserId} />
            </div>
          ))}
        </div>
      )}

      {/* Infinite scroll loader */}
      <div ref={loaderRef} className="py-4">
        {loadingMore && (
          <div className="space-y-0">
            {[0, 1].map((i) => (
              <div key={i} className="bg-surface border-b border-border">
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
        )}
      </div>
    </div>
  );
}
