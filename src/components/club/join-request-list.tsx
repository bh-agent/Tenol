'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, UserPlus, Clock } from 'lucide-react';
import { useState, useTransition } from 'react';
import { respondToJoinRequest } from '@/lib/actions/clubs';
import type { ClubJoinRequest } from '@/types';

interface JoinRequestListProps {
  requests: ClubJoinRequest[];
  clubId: string;
}

export function JoinRequestList({ requests, clubId }: JoinRequestListProps) {
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

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

            return (
              <div
                key={request.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated border border-border"
              >
                {/* Avatar */}
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary-dark/30 flex items-center justify-center flex-shrink-0">
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

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{timeAgo}</span>
                  </div>
                  {request.message && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{request.message}</p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
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
