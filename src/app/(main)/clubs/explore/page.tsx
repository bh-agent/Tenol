export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { searchPublicClubs, getMyJoinRequestsForClubs, getMyMembershipClubIds } from '@/lib/queries/clubs';
import { ExploreClubList } from '@/components/club/explore-club-list';
import { Search, Megaphone } from 'lucide-react';
import Link from 'next/link';

export default async function ExploreClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string }>;
}) {
  const { q, region } = await searchParams;
  const [clubs, memberClubIds] = await Promise.all([
    searchPublicClubs(q, region),
    getMyMembershipClubIds(),
  ]);
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

        {/* Recruit link */}
        <Link
          href="/recruit"
          className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-border hover:border-[#00E676]/30 transition-all duration-200 mb-3"
        >
          <div className="w-9 h-9 rounded-xl bg-[#00E676]/15 flex items-center justify-center flex-shrink-0">
            <Megaphone className="w-4.5 h-4.5 text-[#00E676]" />
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-sm font-semibold text-foreground">모집 게시판</span>
            <p className="text-xs text-muted-foreground">회원 모집 / 게스트 모집 보기</p>
          </div>
        </Link>
      </div>

      <ExploreClubList
        initialClubs={JSON.parse(JSON.stringify(clubs))}
        initialQuery={q || ''}
        initialRegion={region || 'all'}
        memberClubIds={memberClubIds}
        joinRequests={JSON.parse(JSON.stringify(joinRequests))}
      />
    </>
  );
}
