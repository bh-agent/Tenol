'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils/cn';
import { BarChart3 } from 'lucide-react';

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

interface PlayerGameSummaryProps {
  games: GameData[];
  participantMap: Record<string, Participant>;
}

type PlayerSummary = {
  participantId: string;
  name: string;
  gender: string | null;
  gameCount: number;
  gameNumbers: number[];
  courts: number[];
};

export function PlayerGameSummary({ games, participantMap }: PlayerGameSummaryProps) {
  if (games.length === 0) return null;

  // Build per-player summary
  const summaryMap: Record<string, PlayerSummary> = {};

  games.forEach((game, idx) => {
    const gameNumber = idx + 1;
    const playerIds = [
      game.team_a_player1_id,
      game.team_a_player2_id,
      game.team_b_player1_id,
      game.team_b_player2_id,
    ].filter(Boolean) as string[];

    playerIds.forEach((pid) => {
      if (!summaryMap[pid]) {
        const p = participantMap[pid];
        summaryMap[pid] = {
          participantId: pid,
          name: p?.name || '???',
          gender: p?.gender || null,
          gameCount: 0,
          gameNumbers: [],
          courts: [],
        };
      }
      summaryMap[pid].gameCount++;
      summaryMap[pid].gameNumbers.push(gameNumber);
      if (!summaryMap[pid].courts.includes(game.court_number)) {
        summaryMap[pid].courts.push(game.court_number);
      }
    });
  });

  const summaries = Object.values(summaryMap).sort((a, b) => {
    if (b.gameCount !== a.gameCount) return b.gameCount - a.gameCount;
    return a.name.localeCompare(b.name, 'ko');
  });

  if (summaries.length === 0) return null;

  const avgGames = summaries.reduce((sum, s) => sum + s.gameCount, 0) / summaries.length;
  const threshold = avgGames * 0.3; // 30% deviation from average

  return (
    <Card variant="glass" padding="lg">
      <h4 className="font-semibold text-foreground flex items-center gap-2 mb-4">
        <BarChart3 className="w-4 h-4 text-primary" />
        참가자별 경기 요약
      </h4>

      <div className="overflow-x-auto -mx-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">이름</th>
              <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">경기 수</th>
              <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">게임 번호</th>
              <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">코트</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => {
              const isMuchMore = s.gameCount > avgGames + threshold;
              const isMuchLess = s.gameCount < avgGames - threshold;
              return (
                <tr
                  key={s.participantId}
                  className={cn(
                    'border-b border-border/50 last:border-b-0',
                    isMuchMore && 'bg-warning/5',
                    isMuchLess && 'bg-destructive/5'
                  )}
                >
                  <td className="py-2.5 px-2">
                    <span
                      className={cn(
                        'font-medium',
                        s.gender === 'M' ? 'text-info' : s.gender === 'F' ? 'text-pink-400' : 'text-foreground'
                      )}
                    >
                      {s.name}
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-center">
                    <Badge
                      variant={isMuchMore ? 'warning' : isMuchLess ? 'destructive' : 'primary'}
                    >
                      {s.gameCount}
                    </Badge>
                  </td>
                  <td className="py-2.5 px-2 text-muted-foreground">
                    {s.gameNumbers.join(', ')}번
                  </td>
                  <td className="py-2.5 px-2 text-muted-foreground">
                    {s.courts.sort((a, b) => a - b).join(', ')}번
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-3 text-[10px] text-subtle">
        <span>평균 {avgGames.toFixed(1)}경기</span>
        {summaries.some((s) => s.gameCount > avgGames + threshold) && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-warning/50" />
            평균 이상
          </span>
        )}
        {summaries.some((s) => s.gameCount < avgGames - threshold) && (
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-destructive/50" />
            평균 이하
          </span>
        )}
      </div>
    </Card>
  );
}
