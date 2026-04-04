export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { AdminNav } from '@/components/admin/admin-nav';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/stats/stat-card';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { requireAdmin } from '@/lib/utils/admin';
import { getAdminStats, getRecentUsers, getRecentClubs } from '@/lib/queries/admin';
import { ClubAvatar } from '@/components/club/club-avatar';
import { Shield, Users, Building2, Swords, UserPlus, ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  await requireAdmin();

  const [stats, recentUsers, recentClubs] = await Promise.all([
    getAdminStats(),
    getRecentUsers(5),
    getRecentClubs(5),
  ]);

  return (
    <>
      <TopBar
        title="관리자"
        backHref="/profile"
        rightAction={
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30">
            <Shield className="w-3.5 h-3.5 text-red-400" />
            <span className="text-xs font-semibold text-red-400">ADMIN</span>
          </div>
        }
      />

      <AdminNav />

      <div className="px-4 space-y-5 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="전체 유저" value={stats.userCount} variant="primary" />
          <StatCard label="전체 클럽" value={stats.clubCount} />
          <StatCard label="전체 경기" value={stats.matchCount} />
          <StatCard label="오늘 가입" value={stats.todaySignups} variant="success" />
        </div>

        {/* Recent Users */}
        <Card variant="glass" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">최근 가입</h3>
                <p className="text-xs text-muted-foreground">최근 5명</p>
              </div>
            </div>
            <Link href="/admin/users" className="text-xs text-primary hover:text-primary/80 transition-colors">
              전체보기
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentUsers.map((user: any) => (
              <div key={user.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-elevated transition-all">
                <Avatar src={user.avatar_url} alt={user.display_name} fallback={user.display_name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{user.display_name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  </p>
                </div>
                {user.ntrp_level && (
                  <Badge variant="primary" className="text-[10px]">NTRP {user.ntrp_level}</Badge>
                )}
                {user.is_banned && (
                  <Badge variant="destructive" className="text-[10px]">정지</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Clubs */}
        <Card variant="glass" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">최근 생성 클럽</h3>
                <p className="text-xs text-muted-foreground">최근 5개</p>
              </div>
            </div>
            <Link href="/admin/clubs" className="text-xs text-primary hover:text-primary/80 transition-colors">
              전체보기
            </Link>
          </div>
          <div className="space-y-1.5">
            {recentClubs.map((club: any) => (
              <div key={club.id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-elevated transition-all">
                <ClubAvatar logoUrl={club.logo_url} name={club.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{club.name}</p>
                  {club.region && (
                    <p className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {club.region}
                    </p>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(club.created_at).toLocaleDateString('ko-KR')}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
