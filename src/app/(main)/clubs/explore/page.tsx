export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { searchPublicClubs, getMyJoinRequestsForClubs, getMyMembershipClubIds } from '@/lib/queries/clubs';
import { getBookmarkedClubs } from '@/lib/queries/bookmarks';
import { ExploreClubList } from '@/components/club/explore-club-list';
import { Search } from 'lucide-react';

export default async function ExploreClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string }>;
}) {
  const { q, region } = await searchParams;
  const [clubs, bookmarkedClubs, memberClubIds] = await Promise.all([
    searchPublicClubs(q, region),
    getBookmarkedClubs(),
    getMyMembershipClubIds(),
  ]);
  const bookmarkedClubIds = bookmarkedClubs.map((c: any) => c.id);
  const clubIds = clubs.map((c: any) => c.id);
  const joinRequests = await getMyJoinRequestsForClubs(clubIds);

  return (
    <>
      <TopBar title="클럽 탐색" backHref="/clubs" />

      <div className="px-4 pt-4 pb-2 animate-fade-in">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold">
            <span className="text-gradient">클럽 탐색</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            새로운 테니스 클럽을 찾아보세요
          </p>
        </div>
      </div>

      <ExploreClubList
        initialClubs={JSON.parse(JSON.stringify(clubs))}
        initialQuery={q || ''}
        initialRegion={region || 'all'}
        bookmarkedClubIds={bookmarkedClubIds}
        memberClubIds={memberClubIds}
        joinRequests={JSON.parse(JSON.stringify(joinRequests))}
      />
    </>
  );
}
