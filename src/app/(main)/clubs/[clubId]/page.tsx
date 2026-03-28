export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { getClub, getClubMembers, getMyRole, getPendingJoinRequests } from '@/lib/queries/clubs';
import { getClubMatches } from '@/lib/queries/matches';
import { getClubMedia } from '@/lib/queries/media';
import { formatRole } from '@/lib/utils/format';
import { hasPermission } from '@/lib/utils/permissions';
import { RefreshButton } from '@/components/ui/refresh-button';
import { Settings, MapPin, Users, Trophy, BarChart3, Calendar, Swords, Megaphone } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ClubInviteLink } from '@/components/club/club-invite-link';
import { ClubAvatar } from '@/components/club/club-avatar';
import { ClubTabs } from '@/components/club/club-tabs';
import { ClubCreatedCelebration } from '@/components/club/club-created-celebration';
import { ClubActivitySummary } from '@/components/club/club-activity-summary';
import { BookmarkButton } from '@/components/club/bookmark-button';
import { ShareButton } from '@/components/ui/share-button';
import { isClubBookmarked } from '@/lib/queries/bookmarks';
import { JoinRequestList } from '@/components/club/join-request-list';
import { Suspense } from 'react';

export default async function ClubDetailPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const [club, members, matches, media, myRole, bookmarked, joinRequests] = await Promise.all([
    getClub(clubId),
    getClubMembers(clubId),
    getClubMatches(clubId),
    getClubMedia(clubId),
    getMyRole(clubId),
    isClubBookmarked(clubId),
    getPendingJoinRequests(clubId),
  ]);

  if (!club) notFound();

  const canEditClub = hasPermission(myRole, 'club.edit');
  const canManageMembers = hasPermission(myRole, 'member.manage');
  const canCreateMatch = hasPermission(myRole, 'match.create');

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
            <BookmarkButton clubId={clubId} initialBookmarked={bookmarked} />
            <RefreshButton />
            {canEditClub && (
              <Link
                href={`/clubs/${clubId}/settings`}
                className="p-2 rounded-full hover:bg-surface-elevated transition-colors"
              >
                <Settings className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
              </Link>
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

            {/* Invite code for managers */}
            {canManageMembers && (
              <div className="pt-2 border-t border-border">
                <ClubInviteLink code={club.invite_code} />
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Join Requests for admins */}
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
      </div>

      {/* Tabs */}
      <ClubTabs
        clubId={clubId}
        matches={JSON.parse(JSON.stringify(matches))}
        members={JSON.parse(JSON.stringify(members))}
        media={JSON.parse(JSON.stringify(media))}
        myRole={myRole}
        canCreateMatch={canCreateMatch}
        canManageMembers={canManageMembers}
      />
    </>
  );
}
