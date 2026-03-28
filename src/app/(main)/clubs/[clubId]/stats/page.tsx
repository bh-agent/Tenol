export const dynamic = 'force-dynamic';

import { Leaderboard } from '@/components/stats/leaderboard';
import { RecentGamesList } from '@/components/stats/recent-games-list';
import { StatCard } from '@/components/stats/stat-card';
import { WinRateChart } from '@/components/stats/win-rate-chart';
import { Card, CardTitle } from '@/components/ui/card';
import { TopBar } from '@/components/layout/top-bar';
import { getClub } from '@/lib/queries/clubs';
import { getPlayerStats, getPlayerRecentGames, getClubLeaderboard } from '@/lib/queries/stats';
import { createClient } from '@/lib/supabase/server';
import { BarChart3, Trophy, Users, TrendingUp } from 'lucide-react';
import { notFound, redirect } from 'next/navigation';

export default async function ClubStatsPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const club = await getClub(clubId);
  if (!club) notFound();

  const [stats, recentGames, leaderboard] = await Promise.all([
    getPlayerStats(user.id, clubId),
    getPlayerRecentGames(user.id, 10, clubId),
    getClubLeaderboard(clubId),
  ]);

  return (
    <>
      <TopBar title="통계" backHref={`/clubs/${clubId}`} />

      <div className="px-4 py-5 space-y-6 animate-fade-in">
        {/* My Stats Summary */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">내 전적</h2>
              <p className="text-xs text-muted-foreground">{club.name}에서의 기록</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <StatCard label="승률" value={`${stats.winRate}%`} variant="primary" />
            <StatCard label="총 경기" value={stats.total} />
            <StatCard label="승리" value={stats.wins} variant="success" />
            <StatCard label="패배" value={stats.losses} variant="destructive" />
          </div>
        </section>

        {/* Win Rate Chart */}
        {stats.total > 0 && (
          <Card variant="glass" padding="lg">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <CardTitle className="text-base mb-0">승률 차트</CardTitle>
            </div>
            <WinRateChart
              winRate={stats.winRate}
              wins={stats.wins}
              losses={stats.losses}
              total={stats.total}
            />
          </Card>
        )}

        {/* Club Leaderboard */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Trophy className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">클럽 랭킹</h2>
              <p className="text-xs text-muted-foreground">승률 기준 순위</p>
            </div>
          </div>
          <Leaderboard entries={leaderboard} currentUserId={user.id} />
        </section>

        {/* Recent Games */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">최근 경기</h2>
              <p className="text-xs text-muted-foreground">최근 10경기</p>
            </div>
          </div>
          <RecentGamesList games={recentGames} />
        </section>
      </div>
    </>
  );
}
