export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getClub, getClubMembers, getMyRole, getPendingJoinRequests } from '@/lib/queries/clubs';
import { getClubMatches, getPendingGuestCount, getPendingGuestCountByMatch } from '@/lib/queries/matches';
import { formatRole } from '@/lib/utils/format';
import { hasPermission } from '@/lib/utils/permissions';
import { RefreshButton } from '@/components/ui/refresh-button';
import { Settings, MapPin, Users, Trophy, BarChart3, Calendar, Swords, Megaphone, ClipboardList, Repeat } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClubInviteLink } from '@/components/club/club-invite-link';
import { ClubAvatar } from '@/components/club/club-avatar';
import { ClubTabs } from '@/components/club/club-tabs';
import { ClubCreatedCelebration } from '@/components/club/club-created-celebration';
import { ClubActivitySummary } from '@/components/club/club-activity-summary';
import { ShareButton } from '@/components/ui/share-button';
import { JoinRequestList } from '@/components/club/join-request-list';
import { ReportMenuButton } from '@/components/moderation/report-menu-button';
import { Suspense } from 'react';

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const [club, members, matches, myRole] = await Promise.all([
    getClub(clubId),
    getClubMembers(clubId),
    getClubMatches(clubId),
    getMyRole(clubId),
  ]);

  if (!club) notFound();

  const canEditClub = hasPermission(myRole, 'club.edit');
  const canManageMembers = hasPermission(myRole, 'member.manage');
  const canCreateMatch = hasPermission(myRole, 'match.create');

  // Only fetch admin data when the user has permission
  const [joinRequests, pendingGuestCount, pendingGuestByMatch] = canManageMembers
    ? await Promise.all([
        getPendingJoinRequests(clubId),
        getPendingGuestCount(clubId),
        getPendingGuestCountByMatch(clubId),
      ])
    : [[] as Awaited<ReturnType<typeof getPendingJoinRequests>>, 0, {} as Record<string, number>];

  return (
    <>
      <Suspense fallback={null}>
        <ClubCreatedCelebration />
      </Suspense>

      <TopBar
        title={club.name}
        backHref="/clubs"
        rightAction={
          <div className="flex items-center gap-1">
            <ShareButton url={`/clubs/${clubId}`} title={club.name} text={`${club.name} - 테놀`} />
            <RefreshButton />
            {canEditClub && (
              <Link
                href={`/clubs/${clubId}/settings`}
                className="p-2 rounded-full hover:bg-surface-elevated transition-colors"
              >
                <Settings className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
              </Link>
            )}
            {/* 비운영진(클럽 콘텐츠 신고) — Apple 1.2 UGC */}
            {!canEditClub && (
              <ReportMenuButton targetType="club" targetId={clubId} label="클럽 신고" />
            )}
          </div>
        }
      />

      {/* Club Header Card */}
      <div className="px-4 pt-4 pb-2 animate-fade-in">
        <Card variant="glow" padding="lg">
          <div className="space-y-4">
            {/* Club identity */}
            <div className="flex items-center gap-4">
              <ClubAvatar logoUrl={club.logo_url} name={club.name} size="lg" />
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-foreground truncate">{club.name}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {myRole && (
                    <Badge variant="primary">{formatRole(myRole)}</Badge>
                  )}
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" />
                    {members.length}명
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {club.description && (
              <p className="text-sm text-muted-foreground leading-relaxed">{club.description}</p>
            )}

            {/* Meta info */}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {club.region && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-elevated border border-border">
                  <MapPin className="w-3.5 h-3.5 text-primary/70" />
                  {club.region}
                </span>
              )}
              {club.main_court && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-elevated border border-border">
                  <Trophy className="w-3.5 h-3.5 text-primary/70" />
                  {club.main_court}
                </span>
              )}
            </div>

            {/* Invite link for all members */}
            {myRole && (
              <div className="pt-2 border-t border-border">
                <ClubInviteLink code={club.invite_code} />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Admin Management Link */}
      {canManageMembers && (() => {
        const joinCount = joinRequests.length;
        const guestCount = pendingGuestCount;
        const totalPending = joinCount + guestCount;
        return (
          <div className="px-4 pt-2 animate-fade-in">
            <Link
              href={`/clubs/${clubId}/manage`}
              className={`flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-200 ${totalPending > 0 ? 'ring-1 ring-primary/30 shadow-[0_0_12px_rgba(var(--color-primary-rgb,99,102,241),0.15)]' : ''}`}
            >
              <div className="relative w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <ClipboardList className="w-5 h-5 text-primary" />
                {totalPending > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-white text-xs font-bold flex items-center justify-center animate-pulse">
                    {totalPending}
                  </span>
                )}
              </div>
              <div className="flex-1">
                <span className="text-sm font-semibold text-foreground">신청 관리</span>
                <p className="text-xs text-muted-foreground">
                  {joinCount > 0 || guestCount > 0
                    ? `가입 신청 ${joinCount}건, 게스트 신청 ${guestCount}건`
                    : '대기 중인 신청이 없습니다'}
                </p>
              </div>
            </Link>
          </div>
        );
      })()}

      {/* Join Requests for admins (inline quick review) */}
      {canManageMembers && joinRequests.length > 0 && (
        <JoinRequestList
          requests={JSON.parse(JSON.stringify(joinRequests))}
          clubId={clubId}
        />
      )}

      {/* Quick Stats */}
      <div className="px-4 pt-2 pb-0 animate-fade-in">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-muted-foreground">
            <Swords className="w-3.5 h-3.5 text-primary/70" />
            경기 {matches.length}회
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-muted-foreground">
            <Users className="w-3.5 h-3.5 text-primary/70" />
            멤버 {members.length}명
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-primary/70" />
            이번 달 {(() => {
              const now = new Date();
              const y = now.getFullYear();
              const m = now.getMonth();
              return matches.filter((match: any) => {
                const d = new Date(match.match_date);
                return d.getFullYear() === y && d.getMonth() === m;
              }).length;
            })()}회
          </span>
        </div>
      </div>

      {/* Recent Activity */}
      <ClubActivitySummary
        matches={JSON.parse(JSON.stringify(matches))}
        members={JSON.parse(JSON.stringify(members))}
      />

      {/* Quick Links */}
      <div className="px-4 py-2 animate-fade-in space-y-2">
        <Link
          href={`/clubs/${clubId}/stats`}
          className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-semibold text-foreground">통계</span>
            <p className="text-xs text-muted-foreground">클럽 활동 통계 보기</p>
          </div>
        </Link>

        {canManageMembers && (
          <Link
            href={`/clubs/${clubId}/recruit`}
            className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-[#00E676]/30 transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-[#00E676]/15 flex items-center justify-center">
              <Megaphone className="w-5 h-5 text-[#00E676]" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-foreground">모집글 작성</span>
              <p className="text-xs text-muted-foreground">회원 또는 게스트 모집하기</p>
            </div>
          </Link>
        )}

        {canCreateMatch && (
          <Link
            href={`/clubs/${clubId}/templates`}
            className="flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all duration-200"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Repeat className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-foreground">반복 경기 템플릿</span>
              <p className="text-xs text-muted-foreground">정기 경기를 템플릿으로 관리</p>
            </div>
          </Link>
        )}
      </div>

      {/* Tabs */}
      <ClubTabs
        clubId={clubId}
        matches={JSON.parse(JSON.stringify(matches))}
        members={JSON.parse(JSON.stringify(members))}
        myRole={myRole}
        canCreateMatch={canCreateMatch}
        canManageMembers={canManageMembers}
        pendingGuestByMatch={canManageMembers ? pendingGuestByMatch : undefined}
      />

      {/* FAB: 경기 만들기 — 운영진이 스크롤 없이 바로 접근 */}
      {canCreateMatch && (
        <Link
          href={`/clubs/${clubId}/matches/new`}
          aria-label="새 경기 만들기"
          className="hide-on-keyboard fixed right-4 z-30 flex items-center gap-2 h-14 pl-4 pr-5 rounded-full bg-primary text-black font-semibold shadow-lg shadow-primary/30 hover:shadow-[0_0_28px_rgba(0,230,118,0.4)] transition-all duration-300 active:scale-95"
          style={{ bottom: 'calc(88px + env(safe-area-inset-bottom))' }}
        >
          <Swords className="w-5 h-5" strokeWidth={2.2} />
          경기 만들기
        </Link>
      )}
    </>
  );
}
