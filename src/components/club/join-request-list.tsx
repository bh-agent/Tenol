'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, UserPlus, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { useState, useTransition } from 'react';
import { respondToJoinRequest } from '@/lib/actions/clubs';
import type { ClubJoinRequest } from '@/types';
import Link from 'next/link';

function formatTennisCareer(startDate: string | null) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (totalMonths < 1) return '시작한 지 얼마 안 됨';
  if (totalMonths < 12) return `${totalMonths}개월`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years}년 ${months}개월` : `${years}년`;
}

interface JoinRequestListProps {
  requests: ClubJoinRequest[];
  clubId: string;
}

export function JoinRequestList({ requests, clubId }: JoinRequestListProps) {
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (requests.length === 0) return null;

  async function handleRespond(requestId: string, approved: boolean) {
    startTransition(async () => {
      try {
        await respondToJoinRequest(requestId, approved);
        setProcessedIds((prev) => new Set(prev).add(requestId));
      } catch (error: any) {
        alert(error.message || '처리에 실패했습니다');
      }
    });
  }

  const pendingRequests = requests.filter((r) => !processedIds.has(r.id));

  if (pendingRequests.length === 0) return null;

  return (
    <div className="px-4 py-2 animate-fade-in">
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">가입 신청</h3>
          <Badge variant="primary">{pendingRequests.length}</Badge>
        </div>
        <div className="space-y-3">
          {pendingRequests.map((request) => {
            const profile = request.profiles;
            const displayName = profile?.display_name || '알 수 없음';
            const avatarInitial = displayName[0] || '?';
            const createdDate = new Date(request.created_at);
            const timeAgo = getTimeAgo(createdDate);
            const isExpanded = expandedIds.has(request.id);
            const hasDetail = !!(profile?.ntrp_level || (profile as any)?.tennis_start_date || request.introduction || (profile as any)?.bio);

            return (
              <div
                key={request.id}
                className="rounded-xl bg-surface-elevated border border-border overflow-hidden"
              >
                <div className="flex items-center gap-3 p-3">
                  {/* Avatar */}
                  <Link href={`/profile/${request.user_id}`} className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary-dark/30 flex items-center justify-center">
                      {profile?.avatar_url ? (
                        <img
                          src={profile.avatar_url}
                          alt={displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <span className="text-sm font-bold text-primary">{avatarInitial}</span>
                      )}
                    </div>
                  </Link>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/profile/${request.user_id}`}>
                        <p className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">{displayName}</p>
                      </Link>
                      {(profile as any)?.real_name && (
                        <span className="text-xs text-muted-foreground">({(profile as any).real_name})</span>
                      )}
                      {profile?.ntrp_level && (
                        <Badge variant="primary" className="text-[10px] px-1.5 py-0 flex-shrink-0">NTRP {profile.ntrp_level}</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {(profile as any)?.gender && (
                        <Badge variant="outline" className="text-[10px]">
                          {(profile as any).gender === 'male' ? '남' : (profile as any).gender === 'female' ? '여' : ''}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo}
                      </span>
                      {(profile as any)?.tennis_start_date && (
                        <span className="text-xs text-muted-foreground">
                          구력 {formatTennisCareer((profile as any).tennis_start_date)}
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
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleRespond(request.id, true)}
                      disabled={isPending}
                      className="h-8 px-2.5"
                    >
                      <Check className="w-4 h-4" />
                      <span className="hidden sm:inline ml-1">승인</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleRespond(request.id, false)}
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
                      {(profile as any)?.bio && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">프로필 소개</p>
                          <p className="text-sm text-foreground leading-relaxed">{(profile as any).bio}</p>
                        </div>
                      )}
                      {request.introduction && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-0.5">신청 메시지</p>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{request.introduction}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
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
