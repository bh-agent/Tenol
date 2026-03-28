'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TopBar } from '@/components/layout/top-bar';
import { submitScore } from '@/lib/actions/games';
import { createClient } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/utils/permissions';
import type { ClubRole } from '@/types';
import { EmptyState } from '@/components/ui/empty-state';
import { Trophy, RefreshCw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type GameWithDraw = {
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
  draw_id: string;
};

type ParticipantMap = Record<string, string>;

export default function ResultsPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const clubId = params.clubId as string;

  const [games, setGames] = useState<GameWithDraw[]>([]);
  const [participants, setParticipants] = useState<ParticipantMap>({});
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [saving, setSaving] = useState(false);
  const [myRole, setMyRole] = useState<ClubRole | null>(null);
  const [loading, setLoading] = useState(true);

  const canInputResult = hasPermission(myRole, 'result.input');

  const loadData = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: membership } = await supabase
        .from('club_members')
        .select('role')
        .eq('club_id', clubId)
        .eq('user_id', user.id)
        .single();
      setMyRole((membership?.role as ClubRole) || null);
    }

    const { data: draws } = await supabase
      .from('draws')
      .select('id')
      .eq('match_id', matchId);

    if (!draws?.length) {
      setLoading(false);
      return;
    }

    const drawIds = draws.map((d) => d.id);
    const { data: gamesData } = await supabase
      .from('games')
      .select('*')
      .in('draw_id', drawIds)
      .order('court_number')
      .order('game_order');

    const { data: parts } = await supabase
      .from('match_participants')
      .select('id, user_id, guest_name, profiles:user_id (display_name)')
      .eq('match_id', matchId);

    const pMap: ParticipantMap = {};
    parts?.forEach((p: any) => {
      pMap[p.id] = p.profiles?.display_name || p.guest_name || '???';
    });

    setParticipants(pMap);
    setGames((gamesData as any) || []);
    setLoading(false);
  }, [matchId, clubId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getName = (id: string | null) => id ? participants[id] || '???' : '-';

  const handleEdit = (game: GameWithDraw) => {
    setEditingGame(game.id);
    setScoreA(game.score_team_a || 0);
    setScoreB(game.score_team_b || 0);
  };

  const handleSave = async (gameId: string) => {
    setSaving(true);
    try {
      await submitScore(gameId, scoreA, scoreB);
      setEditingGame(null);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '점수 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <TopBar title="경기 결과" backHref={`/clubs/${clubId}/matches/${matchId}`} />

      <div className="px-4 py-4 space-y-3 animate-fade-in">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          </div>
        ) : games.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="아직 등록된 경기가 없어요"
            description="먼저 대진표를 생성해주세요"
          />
        ) : (
          games.map((game) => (
            <Card
              key={game.id}
              padding="md"
              variant={game.winner ? 'glow' : 'default'}
              className="transition-all duration-300"
            >
              {/* Game label */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-surface-elevated border border-border">
                  코트 {game.court_number} - {game.game_order}경기
                </span>
                {game.winner && (
                  <Trophy className="w-4 h-4 text-primary" />
                )}
              </div>

              <div className="flex items-center justify-between">
                {/* Team A */}
                <div className={`flex-1 ${game.winner === 'team_a' ? '' : ''}`}>
                  <p className={`text-sm font-medium ${game.winner === 'team_a' ? 'text-primary' : 'text-foreground'}`}>
                    {getName(game.team_a_player1_id)}
                  </p>
                  {game.team_a_player2_id && (
                    <p className={`text-xs ${game.winner === 'team_a' ? 'text-primary/70' : 'text-muted-foreground'}`}>
                      {getName(game.team_a_player2_id)}
                    </p>
                  )}
                </div>

                {/* Score */}
                {editingGame === game.id ? (
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => setScoreA((s) => s + 1)}
                        className="w-9 h-7 text-xs bg-surface-elevated rounded-lg hover:bg-surface-hover border border-border text-foreground cursor-pointer transition-colors"
                      >
                        +
                      </button>
                      <span className="text-xl font-bold w-9 text-center text-foreground">{scoreA}</span>
                      <button
                        onClick={() => setScoreA((s) => Math.max(0, s - 1))}
                        className="w-9 h-7 text-xs bg-surface-elevated rounded-lg hover:bg-surface-hover border border-border text-foreground cursor-pointer transition-colors"
                      >
                        -
                      </button>
                    </div>
                    <span className="text-muted-foreground font-bold">:</span>
                    <div className="flex flex-col items-center gap-0.5">
                      <button
                        onClick={() => setScoreB((s) => s + 1)}
                        className="w-9 h-7 text-xs bg-surface-elevated rounded-lg hover:bg-surface-hover border border-border text-foreground cursor-pointer transition-colors"
                      >
                        +
                      </button>
                      <span className="text-xl font-bold w-9 text-center text-foreground">{scoreB}</span>
                      <button
                        onClick={() => setScoreB((s) => Math.max(0, s - 1))}
                        className="w-9 h-7 text-xs bg-surface-elevated rounded-lg hover:bg-surface-hover border border-border text-foreground cursor-pointer transition-colors"
                      >
                        -
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="px-5 text-center">
                    {game.score_team_a !== null ? (
                      <span className="font-bold text-xl tracking-wide">
                        <span className={game.winner === 'team_a' ? 'text-primary' : 'text-foreground'}>{game.score_team_a}</span>
                        <span className="text-muted-foreground mx-2">:</span>
                        <span className={game.winner === 'team_b' ? 'text-primary' : 'text-foreground'}>{game.score_team_b}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-surface-elevated border border-border">미입력</span>
                    )}
                  </div>
                )}

                {/* Team B */}
                <div className="flex-1 text-right">
                  <p className={`text-sm font-medium ${game.winner === 'team_b' ? 'text-primary' : 'text-foreground'}`}>
                    {getName(game.team_b_player1_id)}
                  </p>
                  {game.team_b_player2_id && (
                    <p className={`text-xs ${game.winner === 'team_b' ? 'text-primary/70' : 'text-muted-foreground'}`}>
                      {getName(game.team_b_player2_id)}
                    </p>
                  )}
                </div>
              </div>

              {/* Action */}
              {canInputResult && (
                <div className="mt-4 flex justify-end border-t border-border pt-3">
                  {editingGame === game.id ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setEditingGame(null)}>
                        취소
                      </Button>
                      <Button size="sm" onClick={() => handleSave(game.id)} disabled={saving}>
                        {saving ? '저장 중...' : '저장'}
                      </Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => handleEdit(game)}>
                      {game.score_team_a !== null ? '수정' : '점수 입력'}
                    </Button>
                  )}
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </>
  );
}
