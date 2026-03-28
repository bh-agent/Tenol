'use client';

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

type GameType = 'mixed' | 'mens' | 'womens' | 'free';

interface GameRoundCardProps {
  timeSlotIndex: number;
  startTime: string;
  endTime: string;
  games: GameData[];
  participantMap: Record<string, Participant>;
  courtNames: Record<number, string>;
  canManage: boolean;
  canInputScore: boolean;
  sitOutNames?: string[];
  onEditGame?: (game: GameData) => void;
  onScoreSaved?: () => void;
}

// Badge color styles - using style prop to avoid Turbopack parse issues with dynamic classes
const GAME_TYPE_STYLES: Record<GameType, { bg: string; text: string; label: string }> = {
  mixed: { bg: 'rgba(0,230,118,0.15)', text: '#00E676', label: '혼복' },
  mens: { bg: 'rgba(64,196,255,0.15)', text: '#40C4FF', label: '남복' },
  womens: { bg: 'rgba(255,128,171,0.15)', text: '#FF80AB', label: '여복' },
  free: { bg: 'rgba(153,153,153,0.15)', text: '#999999', label: '자유' },
};

function inferGameType(
  game: GameData,
  participantMap: Record<string, Participant>
): GameType {
  const ids = [
    game.team_a_player1_id,
    game.team_a_player2_id,
    game.team_b_player1_id,
    game.team_b_player2_id,
  ].filter(Boolean) as string[];

  const genders = ids.map((id) => participantMap[id]?.gender).filter(Boolean);
  const males = genders.filter((g) => g === 'M').length;
  const females = genders.filter((g) => g === 'F').length;

  if (males > 0 && females > 0) return 'mixed';
  if (males > 0 && females === 0) return 'mens';
  if (females > 0 && males === 0) return 'womens';
  return 'free';
}

export function GameRoundCard({
  timeSlotIndex,
  startTime,
  endTime,
  games,
  participantMap,
  courtNames,
  canManage,
  canInputScore,
  sitOutNames,
  onEditGame,
  onScoreSaved,
}: GameRoundCardProps) {
  const [expandedGameId, setExpandedGameId] = useState<string | null>(null);
  const [savedGameIds, setSavedGameIds] = useState<Set<string>>(new Set());

  const getPlayerName = (id: string | null) =>
    id ? participantMap[id]?.name || '???' : '-';

  const allCompleted = games.every((g) => g.status === 'completed');

  const handleScoreSaved = (gameId: string) => {
    setSavedGameIds((prev) => new Set(prev).add(gameId));
    setExpandedGameId(null);
    onScoreSaved?.();
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
      {/* Time slot header */}
      <div className="flex items-center gap-2">
        <div
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold',
            allCompleted
              ? 'bg-success/10 text-success'
              : 'bg-primary/10 text-primary'
          )}
        >
          {allCompleted && <Check className="w-3.5 h-3.5" />}
          {timeSlotIndex}경기
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>{startTime} ~ {endTime}</span>
        </div>
      </div>

      {/* Court game cards */}
      <div className="space-y-2">
        {sortedGames.map((game) => {
          const isExpanded = expandedGameId === game.id;
          const isCompleted = game.status === 'completed';
          const justSaved = savedGameIds.has(game.id);
          const courtName =
            courtNames[game.court_number] || `${game.court_number}코트`;
          const gameType = inferGameType(game, participantMap);
          const typeStyle = GAME_TYPE_STYLES[gameType];

          return (
            <div
              key={game.id}
              className={cn(
                'rounded-xl border transition-all duration-300',
                isCompleted
                  ? 'bg-surface-elevated border-success/30'
                  : 'bg-surface-elevated border-border',
                justSaved && 'border-success glow-primary-sm'
              )}
            >
              {/* Game card content */}
              <div
                className={cn(
                  'px-3 py-2.5',
                  canInputScore && !isCompleted && 'cursor-pointer active:opacity-90'
                )}
                onClick={() => {
                  if (canInputScore && !isCompleted) {
                    setExpandedGameId(isExpanded ? null : game.id);
                  }
                }}
              >
                {/* Court name + game type badge + edit button */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {courtName}
                    </span>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold"
                      style={{
                        backgroundColor: typeStyle.bg,
                        color: typeStyle.text,
                      }}
                    >
                      {typeStyle.label}
                    </span>
                  </div>
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
                        className="p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
                        title="수정"
                      >
                        <Pencil className="w-3 h-3 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Player names: Team A vs Team B - ALL same size */}
                <div className="flex items-center justify-between">
                  <div className="flex-1 text-center">
                    <div className="text-sm font-medium text-foreground">
                      {getPlayerName(game.team_a_player1_id)}
                    </div>
                    {game.team_a_player2_id && (
                      <div className="text-sm font-medium text-foreground">
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
                    <div className="text-sm font-medium text-foreground">
                      {getPlayerName(game.team_b_player1_id)}
                    </div>
                    {game.team_b_player2_id && (
                      <div className="text-sm font-medium text-foreground">
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
          );
        })}
      </div>

      {/* Sit-out for this time slot */}
      {sitOutNames && sitOutNames.length > 0 && (
        <p className="text-xs text-muted-foreground pl-1">
          {timeSlotIndex}경기 대기: {sitOutNames.join(', ')}
        </p>
      )}
    </div>
  );
}
