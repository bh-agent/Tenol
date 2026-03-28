'use client';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { HeadToHeadResult } from '@/lib/queries/h2h';

interface HeadToHeadProps {
  player1: { id: string; displayName: string; avatarUrl: string | null };
  player2: { id: string; displayName: string; avatarUrl: string | null };
  result: HeadToHeadResult;
  className?: string;
}

export function HeadToHead({ player1, player2, result, className }: HeadToHeadProps) {
  const { player1Wins, player2Wins, totalGames, recentGames } = result;
  const p1Leading = player1Wins > player2Wins;
  const p2Leading = player2Wins > player1Wins;
  const tied = player1Wins === player2Wins;

  return (
    <Card variant="glass" padding="lg" className={cn('', className)}>
      {/* VS Header */}
      <div className="flex items-center justify-between mb-5">
        {/* Player 1 */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <div className={cn(
            'rounded-full p-0.5',
            p1Leading && 'ring-2 ring-[#00E676] ring-offset-2 ring-offset-card'
          )}>
            <Avatar
              src={player1.avatarUrl}
              alt={player1.displayName}
              fallback={player1.displayName}
              size="lg"
            />
          </div>
          <p className={cn(
            'text-sm font-medium text-center truncate max-w-[80px]',
            p1Leading ? 'text-[#00E676]' : 'text-foreground'
          )}>
            {player1.displayName}
          </p>
        </div>

        {/* VS Badge */}
        <div className="flex flex-col items-center gap-1 px-3">
          <span className="text-xs text-muted-foreground font-medium">VS</span>
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-2xl font-bold',
              p1Leading ? 'text-[#00E676]' : tied ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {player1Wins}
            </span>
            <span className="text-muted-foreground font-bold">:</span>
            <span className={cn(
              'text-2xl font-bold',
              p2Leading ? 'text-[#00E676]' : tied ? 'text-foreground' : 'text-muted-foreground'
            )}>
              {player2Wins}
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">{totalGames}경기</span>
        </div>

        {/* Player 2 */}
        <div className="flex flex-col items-center gap-2 flex-1">
          <div className={cn(
            'rounded-full p-0.5',
            p2Leading && 'ring-2 ring-[#00E676] ring-offset-2 ring-offset-card'
          )}>
            <Avatar
              src={player2.avatarUrl}
              alt={player2.displayName}
              fallback={player2.displayName}
              size="lg"
            />
          </div>
          <p className={cn(
            'text-sm font-medium text-center truncate max-w-[80px]',
            p2Leading ? 'text-[#00E676]' : 'text-foreground'
          )}>
            {player2.displayName}
          </p>
        </div>
      </div>

      {/* Recent Games */}
      {recentGames.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-[11px] text-muted-foreground font-medium mb-2">최근 대결</p>
          <div className="space-y-1.5">
            {recentGames.map((game) => (
              <div
                key={game.gameId}
                className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-surface-elevated"
              >
                <span className={cn(
                  'font-medium',
                  game.winner === 'player1' ? 'text-[#00E676]' : 'text-muted-foreground'
                )}>
                  {game.winner === 'player1' ? '승' : '패'}
                </span>
                <span className="text-foreground font-mono">
                  {game.scoreTeamA ?? '-'} : {game.scoreTeamB ?? '-'}
                </span>
                <span className={cn(
                  'font-medium',
                  game.winner === 'player2' ? 'text-[#00E676]' : 'text-muted-foreground'
                )}>
                  {game.winner === 'player2' ? '승' : '패'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
