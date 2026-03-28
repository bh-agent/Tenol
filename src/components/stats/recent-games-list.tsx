import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';
import { Trophy, X } from 'lucide-react';

export interface RecentGame {
  gameId: string;
  matchId: string;
  matchTitle: string;
  clubName: string;
  location: string;
  matchDate: string;
  result: 'win' | 'loss';
  scoreTeamA: number | null;
  scoreTeamB: number | null;
  team: 'team_a' | 'team_b';
}

interface RecentGamesListProps {
  games: RecentGame[];
  className?: string;
}

export function RecentGamesList({ games, className }: RecentGamesListProps) {
  if (games.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-sm text-muted-foreground">최근 경기 기록이 없어요</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2 stagger', className)}>
      {games.map((game) => {
        const isWin = game.result === 'win';
        const myScore = game.team === 'team_a' ? game.scoreTeamA : game.scoreTeamB;
        const opponentScore = game.team === 'team_a' ? game.scoreTeamB : game.scoreTeamA;

        return (
          <Card key={game.gameId} padding="sm">
            <div className="flex items-center gap-3">
              {/* Result icon */}
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0',
                  isWin ? 'bg-primary-dim' : 'bg-destructive/10'
                )}
              >
                {isWin ? (
                  <Trophy className="w-4 h-4 text-primary" />
                ) : (
                  <X className="w-4 h-4 text-destructive" />
                )}
              </div>

              {/* Game info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{game.matchTitle}</p>
                  <Badge variant={isWin ? 'success' : 'destructive'} className="text-[10px]">
                    {isWin ? '승리' : '패배'}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {game.clubName && (
                    <span className="text-[11px] text-muted-foreground">{game.clubName}</span>
                  )}
                  <span className="text-[11px] text-muted-foreground">
                    {formatDate(game.matchDate)}
                  </span>
                </div>
              </div>

              {/* Score */}
              {myScore !== null && opponentScore !== null && (
                <div className="text-right flex-shrink-0">
                  <span className={cn('text-lg font-bold', isWin ? 'text-primary' : 'text-destructive')}>
                    {myScore}
                  </span>
                  <span className="text-muted-foreground mx-1">:</span>
                  <span className="text-lg font-bold text-muted-foreground">
                    {opponentScore}
                  </span>
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
