export const dynamic = 'force-dynamic';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/stats/stat-card';
import { WinRateChart } from '@/components/stats/win-rate-chart';
import { TopBar } from '@/components/layout/top-bar';
import { createClient } from '@/lib/supabase/server';
import { getMyClubs } from '@/lib/queries/clubs';
import { getPlayerStats } from '@/lib/queries/stats';
import { getFollowStatus } from '@/lib/queries/follow';
import { BarChart3, Users, ChevronRight, Crown, Shield, Plus, Search } from 'lucide-react';
import { ClubAvatar } from '@/components/club/club-avatar';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileStatsBar } from '@/components/profile/profile-stats-bar';
import { SignOutButton } from '@/components/profile/sign-out-button';
import { ProfileFeed } from '@/components/profile/profile-feed';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) redirect('/login');

  const [clubs, overallStats, followStatus] = await Promise.all([
    getMyClubs(),
    getPlayerStats(user.id),
    getFollowStatus(user.id),
  ]);

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown className="w-3 h-3" />;
    if (role === 'admin') return <Shield className="w-3 h-3" />;
    return null;
  };

  return (
    <>
      <TopBar title="프로필" />

      <div className="px-4 py-5 space-y-5 animate-fade-in">
        {/* Profile Header */}
        <ProfileHeader profile={JSON.parse(JSON.stringify(profile))} />

        {/* Follow Stats Bar */}
        <ProfileStatsBar
          userId={user.id}
          postCount={followStatus.postCount}
          followerCount={followStatus.followerCount}
          followingCount={followStatus.followingCount}
        />

        {/* Overall Stats Summary */}
        <Card variant="glass" padding="lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">전체 전적</h3>
              <p className="text-xs text-muted-foreground">모든 클럽 통합</p>
            </div>
          </div>

          {overallStats.total > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <StatCard label="승률" value={`${overallStats.winRate}%`} variant="primary" />
                <StatCard label="총 경기" value={overallStats.total} />
                <StatCard label="승리" value={overallStats.wins} variant="success" />
                <StatCard label="패배" value={overallStats.losses} variant="destructive" />
              </div>
              <WinRateChart
                winRate={overallStats.winRate}
                wins={overallStats.wins}
                losses={overallStats.losses}
                total={overallStats.total}
              />
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">아직 경기 기록이 없어요</p>
              <p className="text-xs text-subtle mt-1">클럽에서 경기에 참여해보세요</p>
            </div>
          )}
        </Card>

        {/* My Clubs */}
        <Card variant="glass" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">가입한 클럽</h3>
                <p className="text-xs text-muted-foreground">{clubs.length}개</p>
              </div>
            </div>
          </div>

          {clubs.length === 0 ? (
            <div className="text-center py-8 space-y-4">
              {/* 테니스 라켓 일러스트 (CSS-only) */}
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Users className="w-8 h-8 text-primary/60" />
                </div>
              </div>
              <div>
                <p className="text-base font-semibold text-foreground">아직 클럽이 없어요</p>
                <p className="text-xs text-muted-foreground mt-1">클럽에 가입하고 함께 테니스를 즐겨보세요</p>
              </div>
              <div className="flex gap-3 px-2">
                <Link href="/clubs/new" className="flex-1">
                  <div className="h-11 rounded-xl border border-primary bg-primary/10 text-primary text-sm font-medium flex items-center justify-center gap-1.5 hover:bg-primary/20 transition-all duration-200 active:scale-[0.97]">
                    <Plus className="w-4 h-4" />
                    클럽 만들기
                  </div>
                </Link>
                <Link href="/clubs" className="flex-1">
                  <div className="h-11 rounded-xl border border-border bg-surface-elevated text-foreground text-sm font-medium flex items-center justify-center gap-1.5 hover:border-primary/30 transition-all duration-200 active:scale-[0.97]">
                    <Search className="w-4 h-4" />
                    클럽 탐색하기
                  </div>
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              {clubs.map((club: any) => (
                <Link key={club.id} href={`/clubs/${club.id}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-elevated transition-all duration-200 active:scale-[0.98] group">
                    <ClubAvatar logoUrl={club.logo_url} name={club.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{club.name}</p>
                      {club.region && (
                        <p className="text-[11px] text-muted-foreground">{club.region}</p>
                      )}
                    </div>
                    <Badge
                      variant={club.role === 'owner' ? 'primary' : club.role === 'admin' ? 'success' : 'default'}
                      className="text-[10px]"
                    >
                      <span className="flex items-center gap-1">
                        {getRoleIcon(club.role)}
                        {club.role === 'owner' ? '클럽장' : club.role === 'admin' ? '운영진' : '멤버'}
                      </span>
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Personal Feed */}
        <ProfileFeed userId={user.id} />

        {/* Sign Out */}
        <SignOutButton />
      </div>
    </>
  );
}
