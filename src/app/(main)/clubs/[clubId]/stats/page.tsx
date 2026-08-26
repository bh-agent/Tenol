export const dynamic = 'force-dynamic';

import { AchievementBadges } from '@/components/stats/achievement-badges';
import { AchievementInfoButton } from '@/components/stats/achievement-info-modal';
import { ActivityCalendar } from '@/components/stats/activity-calendar';
import { ClubRecords } from '@/components/stats/club-records';
import { H2HSelector } from '@/components/stats/h2h-selector';
import { Leaderboard } from '@/components/stats/leaderboard';
import { MvpCard } from '@/components/stats/mvp-card';
import { RecentGamesList } from '@/components/stats/recent-games-list';
import { StatCard } from '@/components/stats/stat-card';
import { WinRateChart } from '@/components/stats/win-rate-chart';
import { Card, CardTitle } from '@/components/ui/card';
import { TopBar } from '@/components/layout/top-bar';
import { getClub, getClubMembers } from '@/lib/queries/clubs';
import { getClubAchievements, getAllAchievementMeta } from '@/lib/queries/achievements';
import { getClubMvp } from '@/lib/queries/mvp';
import { getClubRecords, getClubActivityCalendar } from '@/lib/queries/records';
import { getPlayerStats, getPlayerRecentGames, getClubLeaderboard } from '@/lib/queries/stats';
import { createClient } from '@/lib/supabase/server';
import type { MvpPeriod } from '@/lib/queries/mvp';
import { BarChart3, Trophy, Users, TrendingUp, Award, Swords, Calendar } from 'lucide-react';
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

  const periods: MvpPeriod[] = ['week', 'month', 'year', 'all'];
  const now = new Date();

  const [stats, recentGames, leaderboard, achievements, members, clubRecords, activityData, ...mvpResults] = await Promise.all([
    getPlayerStats(user.id, clubId),
    getPlayerRecentGames(user.id, 10, clubId),
    getClubLeaderboard(clubId),
    getClubAchievements(clubId),
    getClubMembers(clubId),
    getClubRecords(clubId),
    getClubActivityCalendar(clubId, now.getFullYear(), now.getMonth() + 1),
    ...periods.map((p) => getClubMvp(clubId, p)),
  ]);

  const mvpByPeriod: Partial<Record<MvpPeriod, Awaited<ReturnType<typeof getClubMvp>>>> = {};
  periods.forEach((p, i) => {
    mvpByPeriod[p] = mvpResults[i];
  });

  // Build player options for H2H selector
  const playerOptions = members
    .map((m: any) => ({
      id: m.profiles?.id as string,
      displayName: (m.profiles?.display_name as string) || '알 수 없음',
      avatarUrl: (m.profiles?.avatar_url as string | null) || null,
    }))
    .filter((p) => p.id);

  return (
    <>
      <TopBar title="통계" backHref={`/clubs/${clubId}`} />

      <div className="px-4 py-5 space-y-6 animate-fade-in">
        {/* MVP Section */}
        <section>
          <MvpCard mvpByPeriod={mvpByPeriod} periods={periods} />
        </section>

        {/* Achievement Badges */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#FFD740]/15 flex items-center justify-center">
                <Award className="w-5 h-5 text-[#FFD740]" />
              </div>
              <div>
                <h2 className="font-semibold text-foreground">업적 배지</h2>
                <p className="text-xs text-muted-foreground">클럽 내 특별한 기록 보유자</p>
              </div>
            </div>
            <AchievementInfoButton
              allMeta={getAllAchievementMeta()}
              achievements={achievements}
            />
          </div>
          {achievements.length > 0 && (
            <AchievementBadges achievements={achievements} />
          )}
        </section>

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

          <div className="grid grid-cols-2 gap-2">
            <StatCard label="승률" value={`${stats.winRate}%`} variant="primary" />
            <StatCard label="총 경기" value={stats.total} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            <StatCard label="승리" value={stats.wins} variant="success" />
            <StatCard label="패배" value={stats.losses} variant="destructive" />
            <StatCard label="무승부" value={stats.draws} />
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

        {/* Activity Calendar */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">활동 캘린더</h2>
              <p className="text-xs text-muted-foreground">이번 달 경기 현황</p>
            </div>
          </div>
          <ActivityCalendar activityData={activityData} />
        </section>

        {/* Club Records */}
        {clubRecords.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[#FFD740]/15 flex items-center justify-center">
                <span className="text-lg">🏆</span>
              </div>
              <div>
                <h2 className="font-semibold text-foreground">클럽 기록</h2>
                <p className="text-xs text-muted-foreground">역대 최고 기록들</p>
              </div>
            </div>
            <ClubRecords records={clubRecords} />
          </section>
        )}

        {/* Head-to-Head Comparison */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Swords className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">전적 비교</h2>
              <p className="text-xs text-muted-foreground">두 선수의 상대 전적</p>
            </div>
          </div>
          <H2HSelector
            players={playerOptions}
            clubId={clubId}
            currentUserId={user.id}
          />
        </section>

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
