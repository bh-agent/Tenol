'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

type GameData = {
  id: string;
  score_team_a: number | null;
  score_team_b: number | null;
  winner: string | null;
  status: string;
  team_a_player1_id: string | null;
  team_a_player2_id: string | null;
  team_b_player1_id: string | null;
  team_b_player2_id: string | null;
};

interface MatchSummaryProps {
  games: GameData[];
  participantNames: Record<string, string>;
  participantNtrp?: Record<string, number | null>;
  className?: string;
}

type SummaryItem = {
  emoji: string;
  title: string;
  description: string;
};

export function MatchSummary({
  games,
  participantNames,
  participantNtrp,
  className,
}: MatchSummaryProps) {
  const completedGames = games.filter((g) => g.status === 'completed');

  // Only show summary when all games are completed
  if (completedGames.length === 0 || completedGames.length < games.length) {
    return null;
  }

  const summaryItems: SummaryItem[] = [];

  // Total games played
  summaryItems.push({
    emoji: '🎾',
    title: '총 경기 수',
    description: `오늘 ${completedGames.length}경기가 진행되었어요!`,
  });

  // Closest game (smallest score difference)
  let closestGame: GameData | null = null;
  let smallestDiff = Infinity;

  for (const game of completedGames) {
    if (game.score_team_a !== null && game.score_team_b !== null) {
      const diff = Math.abs(game.score_team_a - game.score_team_b);
      if (diff < smallestDiff) {
        smallestDiff = diff;
        closestGame = game;
      }
    }
  }

  if (closestGame && closestGame.score_team_a !== null && closestGame.score_team_b !== null) {
    const teamANames = [closestGame.team_a_player1_id, closestGame.team_a_player2_id]
      .filter(Boolean)
      .map((id) => participantNames[id!] || '???')
      .join(', ');
    const teamBNames = [closestGame.team_b_player1_id, closestGame.team_b_player2_id]
      .filter(Boolean)
      .map((id) => participantNames[id!] || '???')
      .join(', ');

    summaryItems.push({
      emoji: '😰',
      title: '가장 치열했던 경기',
      description: `${teamANames} vs ${teamBNames} (${closestGame.score_team_a}:${closestGame.score_team_b}) - ${smallestDiff === 0 ? '무승부!' : `겨우 ${smallestDiff}점 차이!`}`,
    });
  }

  // Biggest upset (lowest NTRP team beating highest)
  if (participantNtrp && Object.keys(participantNtrp).length > 0) {
    let biggestUpset: { game: GameData; ntrpDiff: number } | null = null;

    for (const game of completedGames) {
      if (!game.winner) continue;

      const teamAPlayerIds = [game.team_a_player1_id, game.team_a_player2_id].filter(Boolean) as string[];
      const teamBPlayerIds = [game.team_b_player1_id, game.team_b_player2_id].filter(Boolean) as string[];

      const avgNtrpA = getAvgNtrp(teamAPlayerIds, participantNtrp);
      const avgNtrpB = getAvgNtrp(teamBPlayerIds, participantNtrp);

      if (avgNtrpA === null || avgNtrpB === null) continue;

      // Check if the lower-rated team won
      let ntrpDiff = 0;
      if (game.winner === 'team_a' && avgNtrpA < avgNtrpB) {
        ntrpDiff = avgNtrpB - avgNtrpA;
      } else if (game.winner === 'team_b' && avgNtrpB < avgNtrpA) {
        ntrpDiff = avgNtrpA - avgNtrpB;
      }

      if (ntrpDiff > 0 && (!biggestUpset || ntrpDiff > biggestUpset.ntrpDiff)) {
        biggestUpset = { game, ntrpDiff };
      }
    }

    if (biggestUpset) {
      const g = biggestUpset.game;
      const winnerTeam = g.winner === 'team_a'
        ? [g.team_a_player1_id, g.team_a_player2_id]
        : [g.team_b_player1_id, g.team_b_player2_id];
      const winnerNames = winnerTeam
        .filter(Boolean)
        .map((id) => participantNames[id!] || '???')
        .join(', ');

      summaryItems.push({
        emoji: '🤯',
        title: '오늘의 이변',
        description: `${winnerNames}팀이 NTRP ${biggestUpset.ntrpDiff.toFixed(1)} 차이를 뒤집었어요!`,
      });
    }
  }

  // Find the biggest score blowout
  let biggestBlowout: GameData | null = null;
  let biggestDiff = 0;

  for (const game of completedGames) {
    if (game.score_team_a !== null && game.score_team_b !== null) {
      const diff = Math.abs(game.score_team_a - game.score_team_b);
      if (diff > biggestDiff) {
        biggestDiff = diff;
        biggestBlowout = game;
      }
    }
  }

  if (biggestBlowout && biggestDiff >= 3 && biggestBlowout.score_team_a !== null && biggestBlowout.score_team_b !== null) {
    const winnerTeam = biggestBlowout.winner === 'team_a'
      ? [biggestBlowout.team_a_player1_id, biggestBlowout.team_a_player2_id]
      : [biggestBlowout.team_b_player1_id, biggestBlowout.team_b_player2_id];
    const winnerNames = winnerTeam
      .filter(Boolean)
      .map((id) => participantNames[id!] || '???')
      .join(', ');

    summaryItems.push({
      emoji: '🔥',
      title: '압도적 승리',
      description: `${winnerNames}팀이 ${biggestDiff}점 차이로 완승! (${biggestBlowout.score_team_a}:${biggestBlowout.score_team_b})`,
    });
  }

  if (summaryItems.length <= 1) return null;

  return (
    <Card
      variant="glass"
      padding="lg"
      className={cn(
        'border-[#FFD740]/15 animate-fade-in',
        className
      )}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🏆</span>
        <h3 className="text-base font-semibold text-[#FFD740]">오늘의 명장면</h3>
      </div>

      <div className="space-y-3">
        {summaryItems.map((item, i) => (
          <div
            key={i}
            className="flex items-start gap-3 px-3 py-2.5 rounded-xl bg-surface-elevated/50"
          >
            <span className="text-lg flex-shrink-0 mt-0.5">{item.emoji}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#00E676] mb-0.5">{item.title}</p>
              <p className="text-sm text-foreground/90 leading-relaxed">{item.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function getAvgNtrp(
  playerIds: string[],
  ntrpMap: Record<string, number | null>
): number | null {
  const values = playerIds
    .map((id) => ntrpMap[id])
    .filter((v): v is number => v !== null && v !== undefined);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
