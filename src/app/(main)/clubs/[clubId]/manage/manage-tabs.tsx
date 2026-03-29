'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { respondToJoinRequest } from '@/lib/actions/clubs';
import { respondToGuest } from '@/lib/actions/matches';
import type { ClubJoinRequest } from '@/types';
import type { PendingGuestApplication } from '@/lib/queries/clubs';
import {
  UserPlus,
  Users,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
  Calendar,
  Inbox,
} from 'lucide-react';
import { useState, useTransition } from 'react';

function formatTennisCareer(startDate: string | null) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const totalMonths =
    (now.getFullYear() - start.getFullYear()) * 12 +
    (now.getMonth() - start.getMonth());
  if (totalMonths < 1) return '시작한 지 얼마 안 됨';
  if (totalMonths < 12) return `${totalMonths}개월`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years}년 ${months}개월` : `${years}년`;
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHour < 24) return `${diffHour}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatMatchDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

interface ManageTabsProps {
  clubId: string;
  joinRequests: ClubJoinRequest[];
  guestApplications: PendingGuestApplication[];
}

export function ManageTabs({
  clubId,
  joinRequests,
  guestApplications,
}: ManageTabsProps) {
  const [activeTab, setActiveTab] = useState<'join' | 'guest'>('join');
  const [processedJoinIds, setProcessedJoinIds] = useState<Set<string>>(new Set());
  const [processedGuestIds, setProcessedGuestIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const pendingJoins = joinRequests.filter((r) => !processedJoinIds.has(r.id));
  const pendingGuests = guestApplications.filter((g) => !processedGuestIds.has(g.id));

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleJoinRespond(requestId: string, approved: boolean) {
    startTransition(async () => {
      try {
        await respondToJoinRequest(requestId, approved);
        setProcessedJoinIds((prev) => new Set(prev).add(requestId));
      } catch (error: any) {
        alert(error.message || '처리에 실패했습니다');
      }
    });
  }

  async function handleGuestRespond(
    participantId: string,
    matchId: string,
    approved: boolean
  ) {
    startTransition(async () => {
      try {
        await respondToGuest(participantId, matchId, approved);
        setProcessedGuestIds((prev) => new Set(prev).add(participantId));
      } catch (error: any) {
        alert(error.message || '처리에 실패했습니다');
      }
    });
  }

  // Group guests by match
  const guestsByMatch = pendingGuests.reduce<
    Record<string, { title: string; date: string; guests: PendingGuestApplication[] }>
  >((acc, guest) => {
    if (!acc[guest.match_id]) {
      acc[guest.match_id] = {
        title: guest.match_title,
        date: guest.match_date,
        guests: [],
      };
    }
    acc[guest.match_id].guests.push(guest);
    return acc;
  }, {});

  return (
    <div>
      {/* Tab bar */}
      <div className="flex border-b border-border px-4">
        <button
          onClick={() => setActiveTab('join')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
            activeTab === 'join'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            클럽 가입
            {pendingJoins.length > 0 && (
              <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                {pendingJoins.length}
              </Badge>
            )}
          </span>
          {activeTab === 'join' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('guest')}
          className={`flex-1 py-3 text-sm font-medium text-center transition-colors relative ${
            activeTab === 'guest'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            게스트 신청
            {pendingGuests.length > 0 && (
              <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                {pendingGuests.length}
              </Badge>
            )}
          </span>
          {activeTab === 'guest' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
          )}
        </button>
      </div>

      {/* Tab content */}
      <div className="px-4 py-4">
        {activeTab === 'join' && (
          <div className="animate-fade-in">
            {pendingJoins.length === 0 ? (
              <EmptyState
                icon={UserPlus}
                title="대기 중인 가입 신청이 없습니다"
                description="새로운 가입 신청이 들어오면 여기에 표시됩니다."
              />
            ) : (
              <div className="space-y-3">
                {pendingJoins.map((request) => {
                  const profile = request.profiles;
                  const displayName = profile?.display_name || '알 수 없음';
                  const avatarInitial = displayName[0] || '?';
                  const createdDate = new Date(request.created_at);
                  const timeAgo = getTimeAgo(createdDate);
                  const isExpanded = expandedIds.has(request.id);
                  const hasDetail = !!(
                    profile?.ntrp_level ||
                    (profile as any)?.tennis_start_date ||
                    request.introduction
                  );

                  return (
                    <div
                      key={request.id}
                      className="rounded-xl bg-surface-elevated border border-border overflow-hidden"
                    >
                      <div className="flex items-center gap-3 p-3">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary-dark/30 flex items-center justify-center flex-shrink-0">
                          {profile?.avatar_url ? (
                            <img
                              src={profile.avatar_url}
                              alt={displayName}
                              className="w-10 h-10 rounded-full object-cover"
                            />
                          ) : (
                            <span className="text-sm font-bold text-primary">
                              {avatarInitial}
                            </span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-foreground truncate">
                              {displayName}
                            </p>
                            {profile?.ntrp_level && (
                              <Badge
                                variant="primary"
                                className="text-[10px] px-1.5 py-0"
                              >
                                NTRP {profile.ntrp_level}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {timeAgo}
                            </span>
                            {(profile as any)?.tennis_start_date && (
                              <span className="text-xs text-muted-foreground">
                                구력{' '}
                                {formatTennisCareer(
                                  (profile as any).tennis_start_date
                                )}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {hasDetail && (
                            <button
                              onClick={() => toggleExpand(request.id)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                          <Button
                            size="sm"
                            variant="primary"
                            onClick={() => handleJoinRespond(request.id, true)}
                            disabled={isPending}
                            className="h-8 px-2.5"
                          >
                            <Check className="w-4 h-4" />
                            <span className="hidden sm:inline ml-1">승인</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleJoinRespond(request.id, false)}
                            disabled={isPending}
                            className="h-8 px-2.5 text-muted-foreground hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                            <span className="hidden sm:inline ml-1">거절</span>
                          </Button>
                        </div>
                      </div>

                      {/* Expanded detail */}
                      {isExpanded && hasDetail && (
                        <div className="px-3 pb-3 pt-0 border-t border-border/50 mt-0">
                          <div className="pt-2 space-y-1.5">
                            {request.introduction && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                  자기소개
                                </p>
                                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                  {request.introduction}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'guest' && (
          <div className="animate-fade-in">
            {pendingGuests.length === 0 ? (
              <EmptyState
                icon={Users}
                title="대기 중인 게스트 신청이 없습니다"
                description="경기에 게스트 신청이 들어오면 여기에 표시됩니다."
              />
            ) : (
              <div className="space-y-5">
                {Object.entries(guestsByMatch).map(
                  ([matchId, { title, date, guests }]) => (
                    <div key={matchId}>
                      {/* Match group header */}
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="w-4 h-4 text-primary/70" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">
                            {title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatMatchDate(date)}
                          </p>
                        </div>
                        <Badge variant="default" className="text-[10px]">
                          {guests.length}건
                        </Badge>
                      </div>

                      {/* Guest cards */}
                      <div className="space-y-2">
                        {guests.map((guest) => {
                          const profile = guest.profiles;
                          const displayName =
                            profile?.display_name || guest.guest_name || '알 수 없음';
                          const avatarInitial = displayName[0] || '?';
                          const ntrp =
                            guest.ntrp_override || profile?.ntrp_level || null;
                          const createdDate = new Date(guest.created_at);
                          const timeAgo = getTimeAgo(createdDate);
                          const isExpanded = expandedIds.has(guest.id);
                          const hasDetail = !!(
                            ntrp ||
                            profile?.tennis_start_date ||
                            guest.introduction
                          );

                          return (
                            <div
                              key={guest.id}
                              className="rounded-xl bg-surface-elevated border border-border overflow-hidden"
                            >
                              <div className="flex items-center gap-3 p-3">
                                {/* Avatar */}
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary-dark/30 flex items-center justify-center flex-shrink-0">
                                  {profile?.avatar_url ? (
                                    <img
                                      src={profile.avatar_url}
                                      alt={displayName}
                                      className="w-10 h-10 rounded-full object-cover"
                                    />
                                  ) : (
                                    <span className="text-sm font-bold text-primary">
                                      {avatarInitial}
                                    </span>
                                  )}
                                </div>

                                {/* Info */}
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-foreground truncate">
                                      {displayName}
                                    </p>
                                    {!guest.user_id && (
                                      <Badge
                                        variant="default"
                                        className="text-[10px] px-1.5 py-0"
                                      >
                                        비회원
                                      </Badge>
                                    )}
                                    {ntrp && (
                                      <Badge
                                        variant="primary"
                                        className="text-[10px] px-1.5 py-0"
                                      >
                                        NTRP {ntrp}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {timeAgo}
                                    </span>
                                    {profile?.tennis_start_date && (
                                      <span className="text-xs text-muted-foreground">
                                        구력{' '}
                                        {formatTennisCareer(
                                          profile.tennis_start_date
                                        )}
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {hasDetail && (
                                    <button
                                      onClick={() => toggleExpand(guest.id)}
                                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
                                    >
                                      {isExpanded ? (
                                        <ChevronUp className="w-4 h-4" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4" />
                                      )}
                                    </button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="primary"
                                    onClick={() =>
                                      handleGuestRespond(
                                        guest.id,
                                        guest.match_id,
                                        true
                                      )
                                    }
                                    disabled={isPending}
                                    className="h-8 px-2.5"
                                  >
                                    <Check className="w-4 h-4" />
                                    <span className="hidden sm:inline ml-1">
                                      승인
                                    </span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() =>
                                      handleGuestRespond(
                                        guest.id,
                                        guest.match_id,
                                        false
                                      )
                                    }
                                    disabled={isPending}
                                    className="h-8 px-2.5 text-muted-foreground hover:text-destructive"
                                  >
                                    <X className="w-4 h-4" />
                                    <span className="hidden sm:inline ml-1">
                                      거절
                                    </span>
                                  </Button>
                                </div>
                              </div>

                              {/* Expanded detail */}
                              {isExpanded && hasDetail && (
                                <div className="px-3 pb-3 pt-0 border-t border-border/50 mt-0">
                                  <div className="pt-2 space-y-1.5">
                                    {guest.introduction && (
                                      <div>
                                        <p className="text-xs font-medium text-muted-foreground mb-0.5">
                                          자기소개
                                        </p>
                                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                                          {guest.introduction}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
