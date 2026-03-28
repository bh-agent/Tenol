export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { getMyMatches } from '@/lib/queries/matches';
import { MyMatchesTabs } from '@/components/match/my-matches-tabs';
import { Trophy } from 'lucide-react';
import { Suspense } from 'react';

export default async function MyMatchesPage() {
  const myMatches = await getMyMatches();

  const upcoming: any[] = [];
  const history: any[] = [];

  myMatches.forEach((item: any) => {
    const match = item.matches;
    if (!match) return;
    if (match.status === 'upcoming' || match.status === 'in_progress') {
      upcoming.push(item);
    } else {
      history.push(item);
    }
  });

  return (
    <>
      <TopBar
        title="내 경기"
        rightAction={
          <Suspense fallback={null}>
            <NotificationBell />
          </Suspense>
        }
      />

      <div className="px-4 pt-4 pb-2">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Trophy className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              <span className="text-gradient">내 경기</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              {upcoming.length > 0 ? `예정된 경기 ${upcoming.length}개` : '예정된 경기가 없습니다'}
            </p>
          </div>
        </div>
      </div>

      <MyMatchesTabs
        upcoming={JSON.parse(JSON.stringify(upcoming))}
        history={JSON.parse(JSON.stringify(history))}
      />
    </>
  );
}
