'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { GuestActions } from '@/components/match/guest-actions';
import { Clock, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

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

interface GuestPendingListProps {
  pending: any[];
  matchId: string;
}

export function GuestPendingList({ pending, matchId }: GuestPendingListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (pending.length === 0) return null;

  return (
    <Card variant="glass" padding="lg">
      <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
        <div className="w-2 h-2 rounded-full bg-warning animate-pulse" />
        게스트 승인 대기 ({pending.length}명)
      </h3>
      <div className="space-y-3">
        {pending.map((p: any) => {
          const displayName = p.profiles?.display_name || p.guest_name || '알 수 없음';
          const career = formatTennisCareer(p.profiles?.tennis_start_date || null);
          const timeAgo = p.requested_at ? getTimeAgo(new Date(p.requested_at)) : null;
          const isExpanded = expandedIds.has(p.id);
          const hasBio = !!p.profiles?.bio;
          const hasIntroduction = !!p.introduction || hasBio;

          return (
            <div
              key={p.id}
              className="rounded-xl bg-surface-elevated border border-border overflow-hidden"
            >
              <div className="flex items-center gap-3 p-3">
                {/* Avatar */}
                {p.user_id ? (
                  <Link href={`/profile/${p.user_id}`} className="flex-shrink-0">
                    <Avatar
                      src={p.profiles?.avatar_url}
                      alt={displayName}
                      fallback={displayName}
                      size="md"
                    />
                  </Link>
                ) : (
                  <Avatar
                    src={p.profiles?.avatar_url}
                    alt={displayName}
                    fallback={displayName}
                    size="md"
                  />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {p.user_id ? (
                      <Link href={`/profile/${p.user_id}`}>
                        <p className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate">
                          {displayName}
                        </p>
                      </Link>
                    ) : (
                      <p className="text-sm font-semibold text-foreground truncate">
                        {displayName}
                      </p>
                    )}
                    {p.profiles?.real_name && (
                      <span className="text-xs text-muted-foreground">({p.profiles.real_name})</span>
                    )}
                    {p.profiles?.ntrp_level && (
                      <Badge variant="primary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                        NTRP {p.profiles.ntrp_level}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <Badge variant="warning" className="text-[10px]">게스트 대기중</Badge>
                    {p.profiles?.gender && (
                      <Badge variant="outline" className="text-[10px]">
                        {p.profiles.gender === 'M' ? '남' : p.profiles.gender === 'F' ? '여' : ''}
                      </Badge>
                    )}
                    {timeAgo && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {timeAgo}
                      </span>
                    )}
                    {career && (
                      <span className="text-xs text-muted-foreground">
                        구력 {career}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {hasIntroduction && (
                    <button
                      onClick={() => toggleExpand(p.id)}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  )}
                  <GuestActions participantId={p.id} matchId={matchId} />
                </div>
              </div>

              {/* Expandable introduction */}
              {isExpanded && hasIntroduction && (
                <div className="px-3 pb-3 pt-0 border-t border-border/50">
                  <div className="pt-2 space-y-2">
                    {/* Profile summary grid */}
                    <div className="grid grid-cols-2 gap-1.5">
                      {p.profiles?.real_name && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-background">
                          <p className="text-[10px] text-muted-foreground">실명</p>
                          <p className="text-xs font-medium text-foreground">{p.profiles.real_name}</p>
                        </div>
                      )}
                      {p.profiles?.gender && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-background">
                          <p className="text-[10px] text-muted-foreground">성별</p>
                          <p className="text-xs font-medium text-foreground">{p.profiles.gender === 'M' ? '남성' : p.profiles.gender === 'F' ? '여성' : ''}</p>
                        </div>
                      )}
                      {p.profiles?.ntrp_level && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-background">
                          <p className="text-[10px] text-muted-foreground">NTRP</p>
                          <p className="text-xs font-medium text-foreground">{p.profiles.ntrp_level}</p>
                        </div>
                      )}
                      {p.profiles?.tennis_start_date && (
                        <div className="px-2.5 py-1.5 rounded-lg bg-background">
                          <p className="text-[10px] text-muted-foreground">구력</p>
                          <p className="text-xs font-medium text-foreground">{formatTennisCareer(p.profiles.tennis_start_date)}</p>
                        </div>
                      )}
                    </div>
                    {hasBio && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">프로필 소개</p>
                        <p className="text-sm text-foreground leading-relaxed">{p.profiles.bio}</p>
                      </div>
                    )}
                    {p.introduction && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-0.5">신청 메시지</p>
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                          {p.introduction}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Show introduction inline (truncated) when not expanded and has intro */}
              {!isExpanded && hasIntroduction && (
                <div className="px-3 pb-2 pt-0">
                  <p
                    className="text-xs text-muted-foreground leading-relaxed truncate border-t border-border/50 pt-1.5 cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => toggleExpand(p.id)}
                  >
                    {p.introduction || p.profiles?.bio}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
