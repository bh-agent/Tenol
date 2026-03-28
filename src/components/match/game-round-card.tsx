'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { Check, Clock, Pencil } from 'lucide-react';
import { useState } from 'react';
import { InlineScoreInput } from './inline-score-input';

type GameData = {
  id: string;
  court_number: number;
  game_order: number;
  team_a_player1_id: string | null;
  team_a_player2_id: string | null;
  team_b_player1_id: string | null;
  team_b_player2_id: string | null;
  score_team_a: number | null;
  score_team_b: number | null;
  winner: string | null;
  status: string;
};

type Participant = {
  id: string;
  user_id: string | null;
  guest_name: string | null;
  participant_type: string;
  status: string;
  ntrp_override: number | null;
  guest_gender: string | null;
  name: string;
  ntrp: number | null;
  gender: string | null;
};

interface GameRoundCardProps {
  gameOrder: number;
  games: GameData[];
  participantMap: Record<string, Participant>;
  courtNames: Record<number, string>;
  timeSlot?: { startTime: string; endTime: string };
  canManage: boolean;
  canInputScore: boolean;
  onEditGame?: (game: GameData) => void;
  onScoreSaved?: () => void;
}

export function GameRoundCard({
  gameOrder,
  games,
  participantMap,
  courtNames,
  timeSlot,
  canManage,
  canInputScore,
  onEditGame,
  onScoreSaved,
}: GameRoundCardProps) {
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [savedGameIds, setSavedGameIds] = useState<Set<string>>(new Set());

  const getPlayerName = (id: string | null) =>
    id ? participantMap[id]?.name || '???' : '-';

  const allCompleted = games.every((g) => g.status === 'completed');
  const anyInProgress = games.some(
    (g) => g.status !== 'completed' && g.status !== 'pending'
  );

  const handleScoreSaved = (gameId: string) => {
    setSavedGameIds((prev) => new Set(prev).add(gameId));
    setExpandedGameId(null);
    onScoreSaved?.();
    // Remove checkmark after animation
    setTimeout(() => {
      setSavedGameIds((prev) => {
        const next = new Set(prev);
        next.delete(gameId);
        return next;
      });
    }, 2000);
  };

  const sortedGames = [...games].sort(
    (a, b) => a.court_number - b.court_number
  );

  return (
    <div className="space-y-2">
      {/* Round header */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold',
            allCompleted
              ? 'bg-success/10 text-success'
              : anyInProgress
                ? 'bg-warning/10 text-warning'
                : 'bg-primary/10 text-primary'
          )}
        >
          {allCompleted && <Check className="w-3.5 h-3.5" />}
          {gameOrder}경기
        </div>
        {timeSlot && (
          <Badge variant="default">
            <Clock className="w-3 h-3 mr-1" />
            {timeSlot.startTime}~{timeSlot.endTime}
          </Badge>
        )}
      </div>

      {/* Court games */}
      <div className="space-y-2">
        {sortedGames.map((game, idx) => {
          const isExpanded = expandedGameId === game.id;
          const isCompleted = game.status === 'completed';
          const justSaved = savedGameIds.has(game.id);
          const courtName =
            courtNames[game.court_number] || `${game.court_number}코트`;
          const isLast = idx === sortedGames.length - 1;

          return (
            <div key={game.id} className="relative">
              {/* Tree connector */}
              <div className="absolute left-4 top-0 bottom-0 flex flex-col items-center pointer-events-none">
                {idx < sortedGames.length - 1 && (
                  <div className="absolute top-6 left-0 w-px h-full bg-border/30" />
                )}
              </div>

              <div
                className={cn(
                  'rounded-xl border transition-all duration-300 border-l-4',
                  isCompleted
                    ? 'bg-surface-elevated opacity-80 border-success border-l-success'
                    : anyInProgress
                      ? 'bg-surface-elevated border-border border-l-warning'
                      : 'bg-surface-elevated border-border border-l-primary',
                  justSaved && 'border-success glow-primary-sm'
                )}
              >
                {/* Game card header */}
                <div
                  className={cn(
                    'px-3 py-2.5 cursor-pointer',
                    canInputScore && !isCompleted && 'active:opacity-90'
                  )}
                  onClick={() => {
                    if (canInputScore && !isCompleted) {
                      setExpandedGameId(isExpanded ? null : game.id);
                    }
                  }}
                >
                  {/* Court name + edit button row */}
                  <div className="flex items-center justify-between mb-2">
                    <Badge
                      variant={isCompleted ? 'success' : 'primary'}
                    >
                      {isLast ? '\u2514' : '\u251C'} {courtName}
                    </Badge>
                    <div className="flex items-center gap-1.5">
                      {justSaved && (
                        <div className="animate-fade-in">
                          <Check className="w-4 h-4 text-success" />
                        </div>
                      )}
                      {isCompleted && !justSaved && (
                        <Check className="w-3.5 h-3.5 text-success/60" />
                      )}
                      {canManage && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditGame?.(game);
                          }}
                          className="p-1 rounded-md hover:bg-white/[0.05] transition-colors cursor-pointer"
                          title="수정"
                        >
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Team matchup */}
                  <div className="flex items-center justify-between">
                    <div className="flex-1 text-center">
                      <div
                        className={cn(
                          'text-sm font-medium',
                          game.winner === 'team_a'
                            ? 'text-primary'
                            : 'text-foreground'
                        )}
                      >
                        {getPlayerName(game.team_a_player1_id)}
                      </div>
                      {game.team_a_player2_id && (
                        <div
                          className={cn(
                            'text-xs',
                            game.winner === 'team_a'
                              ? 'text-primary/70'
                              : 'text-muted-foreground'
                          )}
                        >
                          {getPlayerName(game.team_a_player2_id)}
                        </div>
                      )}
                    </div>

                    <div className="px-3 text-center min-w-[60px]">
                      {game.score_team_a !== null ? (
                        <span className="font-bold text-lg">
                          <span
                            className={
                              game.winner === 'team_a'
                                ? 'text-primary'
                                : 'text-foreground'
                            }
                          >
                            {game.score_team_a}
                          </span>
                          <span className="text-muted-foreground mx-1">:</span>
                          <span
                            className={
                              game.winner === 'team_b'
                                ? 'text-primary'
                                : 'text-foreground'
                            }
                          >
                            {game.score_team_b}
                          </span>
                        </span>
                      ) : (
                        <span className="text-xs text-primary font-bold tracking-wider">
                          VS
                        </span>
                      )}
                    </div>

                    <div className="flex-1 text-center">
                      <div
                        className={cn(
                          'text-sm font-medium',
                          game.winner === 'team_b'
                            ? 'text-primary'
                            : 'text-foreground'
                        )}
                      >
                        {getPlayerName(game.team_b_player1_id)}
                      </div>
                      {game.team_b_player2_id && (
                        <div
                          className={cn(
                            'text-xs',
                            game.winner === 'team_b'
                              ? 'text-primary/70'
                              : 'text-muted-foreground'
                          )}
                        >
                          {getPlayerName(game.team_b_player2_id)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Inline score input - expanded */}
                {isExpanded && (
                  <InlineScoreInput
                    game={game}
                    teamAName={[
                      getPlayerName(game.team_a_player1_id),
                      game.team_a_player2_id
                        ? getPlayerName(game.team_a_player2_id)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                    teamBName={[
                      getPlayerName(game.team_b_player1_id),
                      game.team_b_player2_id
                        ? getPlayerName(game.team_b_player2_id)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' / ')}
                    onSaved={() => handleScoreSaved(game.id)}
                    onCancel={() => setExpandedGameId(null)}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
