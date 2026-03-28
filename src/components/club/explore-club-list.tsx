'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/search/search-input';
import { FilterChips } from '@/components/search/filter-chips';
import { SearchEmpty } from '@/components/search/search-empty';
import { MapPin, Users } from 'lucide-react';
import { ClubAvatar } from '@/components/club/club-avatar';
import { BookmarkButton } from '@/components/club/bookmark-button';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { joinPublicClub } from '@/lib/actions/clubs';

const REGION_CHIPS = [
  { key: 'all', label: '전체' },
  { key: '서울', label: '서울' },
  { key: '경기', label: '경기' },
  { key: '인천', label: '인천' },
  { key: '부산', label: '부산' },
  { key: '대구', label: '대구' },
  { key: '광주', label: '광주' },
  { key: '대전', label: '대전' },
  { key: '울산', label: '울산' },
  { key: '세종', label: '세종' },
  { key: '강원', label: '강원' },
  { key: '충북', label: '충북' },
  { key: '충남', label: '충남' },
  { key: '전북', label: '전북' },
  { key: '전남', label: '전남' },
  { key: '경북', label: '경북' },
  { key: '경남', label: '경남' },
  { key: '제주', label: '제주' },
];

interface ExploreClubListProps {
  initialClubs: any[];
  initialQuery: string;
  initialRegion: string;
  bookmarkedClubIds?: string[];
}

export function ExploreClubList({
  initialClubs,
  initialQuery,
  initialRegion,
  bookmarkedClubIds = [],
}: ExploreClubListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [clubs] = useState(initialClubs);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function updateSearch(query: string, region: string) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (region && region !== 'all') params.set('region', region);
    const qs = params.toString();
    router.push(`/clubs/explore${qs ? `?${qs}` : ''}`);
  }

  function handleQueryChange(query: string) {
    const region = searchParams.get('region') || 'all';
    updateSearch(query, region);
  }

  function handleRegionChange(region: string) {
    const query = searchParams.get('q') || '';
    updateSearch(query, region);
  }

  async function handleJoin(clubId: string) {
    setJoiningId(clubId);
    try {
      startTransition(async () => {
        await joinPublicClub(clubId);
      });
    } catch (error: any) {
      alert(error.message || '가입에 실패했습니다');
      setJoiningId(null);
    }
  }

  return (
    <div className="px-4 py-4 space-y-4">
      {/* 검색 */}
      <SearchInput
        placeholder="클럽 이름으로 검색"
        value={initialQuery}
        onChange={handleQueryChange}
      />

      {/* 지역 필터 */}
      <FilterChips
        chips={REGION_CHIPS}
        selected={initialRegion}
        onChange={handleRegionChange}
      />

      {/* 결과 */}
      {clubs.length === 0 ? (
        <SearchEmpty
          query={initialQuery}
          message="클럽을 찾을 수 없어요"
          description={
            initialQuery
              ? `"${initialQuery}"에 대한 공개 클럽이 없습니다.`
              : '조건에 맞는 공개 클럽이 없습니다.'
          }
        />
      ) : (
        <div className="space-y-3 stagger">
          <p className="text-sm text-muted-foreground">
            {clubs.length}개의 클럽
          </p>
          {clubs.map((club: any) => (
            <Card key={club.id} className="hover:border-primary/30 transition-all">
              <div className="flex items-start gap-3">
                <ClubAvatar logoUrl={club.logo_url} name={club.name} size="md" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold text-foreground truncate">{club.name}</h4>
                    <BookmarkButton
                      clubId={club.id}
                      initialBookmarked={bookmarkedClubIds.includes(club.id)}
                    />
                  </div>
                  {club.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {club.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {club.region && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {club.region}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {club.member_count}명
                    </span>
                  </div>
                  <div className="pt-1">
                    <Button
                      size="sm"
                      onClick={() => handleJoin(club.id)}
                      disabled={joiningId === club.id || isPending}
                    >
                      {joiningId === club.id ? '가입 중...' : '가입하기'}
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
