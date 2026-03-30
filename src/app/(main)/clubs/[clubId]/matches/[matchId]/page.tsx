export const dynamic = 'force-dynamic';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TopBar } from '@/components/layout/top-bar';
import { getMatch } from '@/lib/queries/matches';
import { getMyRole } from '@/lib/queries/clubs';
import { formatDate, formatTime, formatMatchStatus, formatDDayWithStatus } from '@/lib/utils/format';
import { hasPermission } from '@/lib/utils/permissions';
import { MapPin, Clock, Users, LayoutGrid, Trophy, ChevronRight, AlertTriangle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MatchActions } from '@/components/match/match-actions';
import { MatchManageButtons } from '@/components/match/match-manage-buttons';
import { GuestPendingList } from '@/components/match/guest-pending-list';
import { MatchBottomBar } from '@/components/match/match-bottom-bar';
import { MatchReminderBanner } from '@/components/match/match-reminder-banner';
import { ShareButton } from '@/components/ui/share-button';
import { createClient } from '@/lib/supabase/server';

export default async function MatchDetailPage({
  params,
}: {
  params: Promise<{ clubId: string; matchId: string }>;
}) {
  const { clubId, matchId } = await params;
  const [match, myRole] = await Promise.all([
    getMatch(matchId),
    getMyRole(clubId),
  ]);

  if (!match) notFound();

  const canManageMembers = hasPermission(myRole, 'member.manage');
  const canCreateMatch = hasPermission(myRole, 'match.create');
  const canManageDraw = hasPermission(myRole, 'draw.manage');
  const canInputResult = hasPermission(myRole, 'result.input');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const confirmed = match.match_participants?.filter((p: any) => p.status === 'confirmed') || [];
  const pending = match.match_participants?.filter((p: any) => p.status === 'pending') || [];

  const isParticipant = user ? confirmed.some((p: any) => p.user_id === user.id) : false;
  const isPendingGuest = user ? pending.some((p: any) => p.user_id === user.id) : false;
  const registrationClosed = !!match.registration_closed;

  // Get user profile for guest application
  let userProfile: { display_name: string; ntrp_level: number | null; tennis_start_date: string | null } | null = null;
  if (user && !myRole) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, ntrp_level, tennis_start_date')
      .eq('id', user.id)
      .maybeSingle();
    userProfile = profile;
  }

  // Doubles need minimum 4 for a draw
  const isDoubles = match.format === 'doubles' || match.format === 'mixed_doubles';
  const minForDraw = isDoubles ? 4 : 2;
  const canGenerateDraw = confirmed.length >= minForDraw;
  const needsMore = !canGenerateDraw;

  const progressPercent = match.max_participants
    ? Math.min(100, Math.round((confirmed.length / match.max_participants) * 100))
    : 0;

  const dDay = formatDDayWithStatus(match.match_date, match.status);

  const statusVariant: Record<string, 'primary' | 'success' | 'default' | 'destructive'> = {
    upcoming: 'primary',
    in_progress: 'success',
    completed: 'default',
    cancelled: 'destructive',
  };

  return (
    <>
      <TopBar
        title={match.title}
        backHref={`/clubs/${clubId}`}
        rightAction={
          <ShareButton
            url={`/clubs/${clubId}/matches/${matchId}`}
            title={match.title}
            text={`${match.title} - 테놀`}
          />
        }
      />

      {match.status === 'upcoming' && (
        <MatchReminderBanner
          matchDate={match.match_date}
          startTime={match.start_time}
          location={match.location}
        />
      )}

      <div className="px-4 py-4 space-y-4 animate-fade-in">
        {/* Match Info Card */}
        <Card variant="glow" padding="lg">
          <div className="space-y-4">
            {/* Status badges */}
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusVariant[match.status] || 'default'}>
                {formatMatchStatus(match.status)}
              </Badge>
              <Badge variant="outline">
                {match.format === 'doubles' ? '복식' : match.format === 'singles' ? '단식' : '혼합 복식'}
              </Badge>
              <Badge
                variant={
                  match.status === 'completed' || match.status === 'cancelled'
                    ? 'default'
                    : dDay === '오늘' || match.status === 'in_progress'
                      ? 'success'
                      : 'warning'
                }
              >
                {dDay}
              </Badge>
            </div>

            {/* Match details */}
            <div className="space-y-2.5">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <span>
                  {formatDate(match.match_date)}
                  {match.start_time && ` ${formatTime(match.start_time)}`}
                  {match.end_time && ` ~ ${formatTime(match.end_time)}`}
                </span>
              </div>
              {match.location && (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-4 h-4 text-primary" />
                  </div>
                  <span>{match.location}</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <LayoutGrid className="w-4 h-4 text-primary" />
                </div>
                <span>코트 {match.court_count}면</span>
              </div>
            </div>

            {match.description && (
              <p className="text-sm text-muted-foreground border-t border-border pt-3 leading-relaxed">
                {match.description}
              </p>
            )}
          </div>
        </Card>

        {/* Edit / Delete Buttons */}
        {canCreateMatch && (
          <MatchManageButtons matchId={matchId} clubId={clubId} status={match.status} />
        )}

        {/* Action Buttons */}
        {canCreateMatch && (
          <MatchActions matchId={matchId} clubId={clubId} canManage={canCreateMatch} status={match.status} />
        )}

        {/* Quick Links */}
        {match.status !== 'cancelled' && (
          <div className="grid grid-cols-2 gap-3">
            <Link href={`/clubs/${clubId}/matches/${matchId}/draw`}>
              <Card className="text-center py-5 hover:border-primary/30 hover:shadow-[0_0_16px_rgba(0,230,118,0.1)] active:scale-[0.97] transition-all duration-300">
                <LayoutGrid className="w-7 h-7 text-primary mx-auto mb-2" />
                <span className="text-sm font-semibold text-foreground">대진표</span>
                {!canManageDraw && <p className="text-[10px] text-muted-foreground mt-1">열람만 가능</p>}
                <ChevronRight className="w-4 h-4 text-muted-foreground mx-auto mt-1" />
              </Card>
            </Link>
            <Link href={`/clubs/${clubId}/matches/${matchId}/results`}>
              <Card className="text-center py-5 hover:border-primary/30 hover:shadow-[0_0_16px_rgba(0,230,118,0.1)] active:scale-[0.97] transition-all duration-300">
                <Trophy className="w-7 h-7 text-primary mx-auto mb-2" />
                <span className="text-sm font-semibold text-foreground">경기 결과</span>
                {!canInputResult && <p className="text-[10px] text-muted-foreground mt-1">열람만 가능</p>}
                <ChevronRight className="w-4 h-4 text-muted-foreground mx-auto mt-1" />
              </Card>
            </Link>
          </div>
        )}

        {/* Pending Guests */}
        {canManageMembers && pending.length > 0 && (
          <GuestPendingList pending={pending} matchId={matchId} />
        )}

        {/* Confirmed Participants */}
        <Card variant="glass" padding="lg">
          <div className="space-y-3 mb-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                참가자 ({confirmed.length}명
                {match.max_participants && `/${match.max_participants}`})
              </h3>
              {canGenerateDraw ? (
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  대진표 생성 가능
                </Badge>
              ) : needsMore && isDoubles ? (
                <Badge variant="warning" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  최소 4명 필요
                </Badge>
              ) : needsMore ? (
                <Badge variant="warning" className="flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  최소 2명 필요
                </Badge>
              ) : null}
            </div>

            {/* Progress bar */}
            {match.max_participants && (
              <div className="space-y-1">
                <div className="h-2 rounded-full bg-surface-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground text-right">
                  {confirmed.length}/{match.max_participants}명 ({progressPercent}%)
                </p>
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            {confirmed.map((p: any) => (
              <div key={p.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-elevated transition-colors">
                {p.user_id ? (
                  <Link href={`/profile/${p.user_id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <Avatar
                      src={p.profiles?.avatar_url}
                      alt={p.profiles?.display_name || p.guest_name}
                      fallback={p.profiles?.display_name || p.guest_name}
                      size="sm"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                        {p.profiles?.display_name || p.guest_name}
                      </span>
                      {p.profiles?.ntrp_level && (
                        <span className="text-xs text-primary ml-2 font-medium">
                          NTRP {p.profiles.ntrp_level}
                        </span>
                      )}
                    </div>
                  </Link>
                ) : (
                  <>
                    <Avatar
                      src={p.profiles?.avatar_url}
                      alt={p.profiles?.display_name || p.guest_name}
                      fallback={p.profiles?.display_name || p.guest_name}
                      size="sm"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-medium text-foreground">
                        {p.profiles?.display_name || p.guest_name}
                      </span>
                      {p.profiles?.ntrp_level && (
                        <span className="text-xs text-primary ml-2 font-medium">
                          NTRP {p.profiles.ntrp_level}
                        </span>
                      )}
                    </div>
                  </>
                )}
                {p.participant_type === 'guest' && (
                  <Badge variant="outline">게스트</Badge>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Bottom spacer for sticky bar */}
        {(match.status === 'upcoming' || match.status === 'in_progress') && (
          <div className="h-20" />
        )}
      </div>

      <MatchBottomBar
        matchId={matchId}
        status={match.status}
        isParticipant={isParticipant}
        registrationClosed={registrationClosed}
        isMember={!!myRole}
        isPendingGuest={isPendingGuest}
        allowGuests={match.allow_guests}
        canManage={canCreateMatch}
        userProfile={userProfile}
      />
    </>
  );
}
