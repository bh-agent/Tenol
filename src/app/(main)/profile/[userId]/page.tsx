export const dynamic = 'force-dynamic';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/stats/stat-card';
import { WinRateChart } from '@/components/stats/win-rate-chart';
import { TopBar } from '@/components/layout/top-bar';
import { ClubAvatar } from '@/components/club/club-avatar';
import { ProfileHeader } from '@/components/profile/profile-header';
import { SignOutButton } from '@/components/profile/sign-out-button';
import { StatShareButton } from '@/components/profile/stat-share-card';
import { createClient } from '@/lib/supabase/server';
import { getMyClubs } from '@/lib/queries/clubs';
import { getPlayerStats } from '@/lib/queries/stats';
import { getProfileStats } from '@/lib/queries/profile-stats';
import { BarChart3, Users, ChevronRight, Crown, Shield, ShieldAlert, Plus, Search, MapPin, Calendar } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();

  // Check current user
  const { data: { user } } = await supabase.auth.getUser();
  const isOwnProfile = user?.id === userId;

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (!profile) notFound();

  // Fetch data in parallel
  const [stats, profileStats, clubsResult] = await Promise.all([
    getPlayerStats(userId),
    getProfileStats(userId),
    isOwnProfile
      ? getMyClubs()
      : supabase
          .from('club_members')
          .select(`club_id, role, clubs (id, name, logo_url, region, is_public)`)
          .eq('user_id', userId)
          .then(({ data }) =>
            (data || [])
              .filter((m) => (m.clubs as any)?.is_public !== false)
              .map((m) => ({ ...(m.clubs as any), role: m.role }))
          ),
  ]);

  const clubs = clubsResult;

  const getRoleIcon = (role: string) => {
    if (role === 'owner') return <Crown className="w-3 h-3" />;
    if (role === 'admin') return <Shield className="w-3 h-3" />;
    return null;
  };

  return (
    <>
      <TopBar
        title={isOwnProfile ? '프로필' : profile.display_name}
      />

      <div className="px-4 py-5 space-y-5 animate-fade-in">
        {/* Profile Header */}
        {isOwnProfile ? (
          <ProfileHeader profile={JSON.parse(JSON.stringify(profile))} />
        ) : (
          <div className="flex flex-col items-center text-center">
            <div className="ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-full">
              <Avatar
                src={profile.avatar_url}
                alt={profile.display_name}
                fallback={profile.display_name}
                size="xl"
              />
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              {profile.real_name || '익명'}
            </p>
            <h2 className="text-xl font-bold text-foreground mt-1">
              {profile.display_name}
            </h2>

            {profile.bio && (
              <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                {profile.bio}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              {profile.ntrp_level && (
                <Badge variant="primary">NTRP {profile.ntrp_level}</Badge>
              )}
              {profile.region && (
                <Badge variant="outline">
                  <MapPin className="w-3 h-3 mr-1" />
                  {profile.region}
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Overall Stats */}
        <Card variant="glass" padding="lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">전체 전적</h3>
              <p className="text-xs text-muted-foreground">모든 클럽 통합</p>
            </div>
            {isOwnProfile && (
              <StatShareButton
                displayName={profile.display_name}
                avatarUrl={profile.avatar_url}
                stats={profileStats}
              />
            )}
          </div>

          {stats.total > 0 ? (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <StatCard label="승률" value={`${stats.winRate}%`} variant="primary" />
                <StatCard label="총 경기" value={stats.total} />
                <StatCard label="승리" value={stats.wins} variant="success" />
                <StatCard label="패배" value={stats.losses} variant="destructive" />
              </div>
              <WinRateChart
                winRate={stats.winRate}
                wins={stats.wins}
                losses={stats.losses}
                total={stats.total}
              />
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-muted-foreground">아직 경기 기록이 없어요</p>
              <p className="text-xs text-subtle mt-1">클럽에서 경기에 참여해보세요</p>
            </div>
          )}
        </Card>

        {/* Clubs */}
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
            isOwnProfile ? (
              <div className="text-center py-8 space-y-4">
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
                  <Link href="/clubs/explore" className="flex-1">
                    <div className="h-11 rounded-xl border border-border bg-surface-elevated text-foreground text-sm font-medium flex items-center justify-center gap-1.5 hover:border-primary/30 transition-all duration-200 active:scale-[0.97]">
                      <Search className="w-4 h-4" />
                      클럽 탐색하기
                    </div>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">가입한 클럽이 없어요</p>
              </div>
            )
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
                    {isOwnProfile && club.role && (
                      <Badge
                        variant={club.role === 'owner' ? 'primary' : club.role === 'admin' ? 'success' : 'default'}
                        className="text-[10px]"
                      >
                        <span className="flex items-center gap-1">
                          {getRoleIcon(club.role)}
                          {club.role === 'owner' ? '클럽장' : club.role === 'admin' ? '운영진' : '멤버'}
                        </span>
                      </Badge>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Admin Mode (admin only) */}
        {isOwnProfile && profile.is_admin && (
          <Link
            href="/admin"
            className="flex items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 hover:border-red-500/40 transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-red-500/15 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">관리자 모드</p>
              <p className="text-xs text-muted-foreground">플랫폼 관리 대시보드</p>
            </div>
            <ChevronRight className="w-5 h-5 text-red-400" />
          </Link>
        )}

        {/* Sign Out (own profile only) */}
        {isOwnProfile && <SignOutButton />}
      </div>
    </>
  );
}
