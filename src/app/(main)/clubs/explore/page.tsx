export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { searchPublicClubs } from '@/lib/queries/clubs';
import { ExploreClubList } from '@/components/club/explore-club-list';
import { Search } from 'lucide-react';

export default async function ExploreClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; region?: string }>;
}) {
  const { q, region } = await searchParams;
  const clubs = await searchPublicClubs(q, region);

  return (
    <>
      <TopBar title="클럽 탐색" backHref="/clubs" />

      <div className="px-4 pt-4 pb-2">
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
      />
    </>
  );
}
