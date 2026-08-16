'use client';

import { cn } from '@/lib/utils/cn';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/search/search-input';
import { RecruitmentCard } from './recruitment-card';
import type { RecruitmentPost, RecruitmentType } from '@/types';
import { Megaphone } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface RecruitmentListProps {
  initialPosts: RecruitmentPost[];
  initialType?: RecruitmentType | 'all';
  initialQuery?: string;
  currentUserId?: string;
  myClubIds?: string[];
}

const filterTabs: { key: RecruitmentType | 'all'; label: string }[] = [
  { key: 'all', label: '전체' },
  { key: 'member_recruit', label: '회원 모집' },
  { key: 'guest_recruit', label: '게스트 모집' },
];

export function RecruitmentList({
  initialPosts,
  initialType = 'all',
  initialQuery = '',
  currentUserId,
  myClubIds,
}: RecruitmentListProps) {
  const router = useRouter();
  const [activeType, setActiveType] = useState<RecruitmentType | 'all'>(initialType);
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [posts, setPosts] = useState(initialPosts);

  useEffect(() => {
    setPosts(initialPosts);
  }, [initialPosts]);

  useEffect(() => {
    setActiveType(initialType);
  }, [initialType]);

  const handleFilterChange = useCallback((type: RecruitmentType | 'all') => {
    setActiveType(type);
    const params = new URLSearchParams();
    if (type !== 'all') params.set('type', type);
    if (searchQuery) params.set('q', searchQuery);
    const qs = params.toString();
    router.push(`/recruit${qs ? `?${qs}` : ''}`);
  }, [searchQuery, router]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    const params = new URLSearchParams();
    if (activeType !== 'all') params.set('type', activeType);
    if (q) params.set('q', q);
    const qs = params.toString();
    router.push(`/recruit${qs ? `?${qs}` : ''}`);
  }, [activeType, router]);

  const handleRemovePost = useCallback((id: string) => {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return (
    <div>
      {/* Search */}
      <div className="px-4 pb-3">
        <SearchInput
          placeholder="클럽명 또는 제목으로 검색"
          value={searchQuery}
          onChange={handleSearch}
        />
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-border px-4">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleFilterChange(tab.key)}
            className={cn(
              'flex-1 py-3 text-sm font-medium text-center transition-colors duration-200 relative cursor-pointer',
              activeType === tab.key
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
            {activeType === tab.key && (
              <span className="absolute bottom-0 left-1/4 right-1/4 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Post list */}
      <div className="px-4 pt-4 space-y-3 pb-32">
        {posts.length === 0 ? (
          <EmptyState
            icon={Megaphone}
            title="모집글이 없습니다"
            description="현재 진행 중인 모집이 없습니다. 나중에 다시 확인해보세요."
          />
        ) : (
          posts.map((post) => (
            <RecruitmentCard
              key={post.id}
              post={post}
              currentUserId={currentUserId}
              isMyClub={myClubIds?.includes(post.club_id)}
              onClose={handleRemovePost}
              onDelete={handleRemovePost}
            />
          ))
        )}
      </div>
    </div>
  );
}
