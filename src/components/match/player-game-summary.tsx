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

type GameTypeKey = 'mixed' | 'mens' | 'womens' | 'free';

interface PlayerGameSummaryProps {
  games: GameData[];
  participantMap: Record<string, Participant>;
  courtNames?: Record<number, string>;
}

type Appearance = {
  gameOrder: number;
  courtNumber: number;
  gameType: GameTypeKey;
};

type PlayerSummary = {
  participantId: string;
  name: string;
  gender: string | null;
  gameCount: number;
  appearances: Appearance[];
  gameTypeCounts: Record<GameTypeKey, number>;
};

const GAME_TYPE_LABELS: Record<GameTypeKey, string> = {
  mixed: '혼복',
  mens: '남복',
  womens: '여복',
  free: '자유',
};

const GAME_TYPE_COLORS: Record<GameTypeKey, string> = {
  mixed: '#00E676',
  mens: '#40C4FF',
  womens: '#FF80AB',
  free: '#999999',
};

function inferGameType(
  game: GameData,
  participantMap: Record<string, Participant>
): GameTypeKey {
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

export function PlayerGameSummary({ games, participantMap, courtNames }: PlayerGameSummaryProps) {
  if (games.length === 0) return null;

  const getCourtName = (courtNum: number) =>
    courtNames?.[courtNum] || `${courtNum}코트`;

  const getGameTypeLabel = (gt: GameTypeKey) => GAME_TYPE_LABELS[gt];

  // Build per-player summary
  const summaryMap: Record<string, PlayerSummary> = {};

  games.forEach((game) => {
    const playerIds = [
      game.team_a_player1_id,
      game.team_a_player2_id,
      game.team_b_player1_id,
      game.team_b_player2_id,
    ].filter(Boolean) as string[];

    const gameType = inferGameType(game, participantMap);

    playerIds.forEach((pid) => {
      if (!summaryMap[pid]) {
        const p = participantMap[pid];
        summaryMap[pid] = {
          participantId: pid,
          name: p?.name || '???',
          gender: p?.gender || null,
          gameCount: 0,
          appearances: [],
          gameTypeCounts: { mixed: 0, mens: 0, womens: 0, free: 0 },
        };
      }
      summaryMap[pid].gameCount++;
      summaryMap[pid].gameTypeCounts[gameType]++;
      summaryMap[pid].appearances.push({
        gameOrder: game.game_order,
        courtNumber: game.court_number,
        gameType,
      });
    });
  });

  // Sort by name (Korean)
  const summaries = Object.values(summaryMap).sort((a, b) =>
    a.name.localeCompare(b.name, 'ko')
  );

  if (summaries.length === 0) return null;

  const avgGames = summaries.reduce((sum, s) => sum + s.gameCount, 0) / summaries.length;
  const threshold = avgGames * 0.3;

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
              <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">총 경기</th>
              <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">참여 순서</th>
              <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">게임 유형</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((s) => {
              const isMuchMore = s.gameCount > avgGames + threshold;
              const isMuchLess = s.gameCount < avgGames - threshold;
              const sorted = [...s.appearances].sort((a, b) => a.gameOrder - b.gameOrder);

              // Build appearance labels: "1번째(A코트,혼복) 3번째(B코트,남복)"
              const appearanceLabels = sorted.map(
                (ap) =>
                  `${ap.gameOrder}번째(${getCourtName(ap.courtNumber)},${getGameTypeLabel(ap.gameType)})`
              );

              // Build game type distribution: "혼복3 남복2"
              const typeDistLabels = (Object.keys(s.gameTypeCounts) as GameTypeKey[])
                .filter((k) => s.gameTypeCounts[k] > 0)
                .map((k) => ({ key: k, count: s.gameTypeCounts[k] }));

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
                      {s.gameCount}경기
                    </Badge>
                  </td>
                  <td className="py-2.5 px-2 text-muted-foreground text-xs leading-relaxed">
                    {appearanceLabels.join(' ')}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex flex-wrap gap-1">
                      {typeDistLabels.map(({ key, count }) => (
                        <span
                          key={key}
                          className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold"
                          style={{
                            backgroundColor: GAME_TYPE_COLORS[key] + '20',
                            color: GAME_TYPE_COLORS[key],
                          }}
                        >
                          {GAME_TYPE_LABELS[key]}{count}
                        </span>
                      ))}
                    </div>
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
