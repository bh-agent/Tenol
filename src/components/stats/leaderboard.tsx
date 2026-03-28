import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { Crown, Medal } from 'lucide-react';

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  ntrpLevel: number | null;
  wins: number;
  losses: number;
  total: number;
  winRate: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  currentUserId?: string;
  className?: string;
}

export function Leaderboard({ entries, currentUserId, className }: LeaderboardProps) {
  if (entries.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-sm text-muted-foreground">아직 경기 기록이 없어요</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2 stagger', className)}>
      {entries.map((entry, index) => {
        const rank = index + 1;
        const isCurrentUser = entry.userId === currentUserId;

        return (
          <Card
            key={entry.userId}
            padding="sm"
            variant={isCurrentUser ? 'glow' : 'default'}
          >
            <div className="flex items-center gap-3">
              {/* Rank */}
              <div className="w-7 flex-shrink-0 text-center">
                {rank === 1 ? (
                  <Crown className="w-5 h-5 text-yellow-500 mx-auto drop-shadow-[0_0_4px_rgba(234,179,8,0.5)]" />
                ) : rank === 2 ? (
                  <Medal className="w-5 h-5 text-muted-foreground mx-auto" />
                ) : rank === 3 ? (
                  <Medal className="w-5 h-5 text-amber-600 mx-auto" />
                ) : (
                  <span className="text-sm font-bold text-muted-foreground">{rank}</span>
                )}
              </div>

              {/* Avatar */}
              <Avatar
                src={entry.avatarUrl}
                alt={entry.displayName}
                fallback={entry.displayName}
                size="sm"
              />

              {/* Player info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className={cn('text-sm font-medium truncate', isCurrentUser ? 'text-primary' : 'text-foreground')}>
                    {entry.displayName}
                    {isCurrentUser && ' (나)'}
                  </p>
                  {entry.ntrpLevel && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {entry.ntrpLevel}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {entry.wins}승 {entry.losses}패 ({entry.total}경기)
                </p>
              </div>

              {/* Win rate */}
              <div className="text-right flex-shrink-0">
                <p className={cn(
                  'text-lg font-bold',
                  entry.winRate >= 60 ? 'text-primary' :
                  entry.winRate >= 40 ? 'text-foreground' :
                  'text-destructive'
                )}>
                  {entry.winRate}%
                </p>
                <p className="text-[10px] text-muted-foreground">승률</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
