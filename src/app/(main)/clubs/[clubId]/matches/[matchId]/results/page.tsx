'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { MatchSummary } from '@/components/match/match-summary';
import { TopBar } from '@/components/layout/top-bar';
import { submitScore } from '@/lib/actions/games';
import { createClient } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/utils/permissions';
import type { ClubRole } from '@/types';
import { EmptyState } from '@/components/ui/empty-state';
import { Trophy, RefreshCw, Crown } from 'lucide-react';
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

type MatchMvpData = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  ntrp_level: number | null;
  total_score: number;
  games_played: number;
  wins: number;
};

export default function ResultsPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const clubId = params.clubId as string;

  const [games, setGames] = useState<GameWithDraw[]>([]);
  const [participants, setParticipants] = useState<ParticipantMap>({});
  const [participantNtrp, setParticipantNtrp] = useState<Record<string, number | null>>({});
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [saving, setSaving] = useState(false);
  const [myRole, setMyRole] = useState<ClubRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [matchMvp, setMatchMvp] = useState<MatchMvpData | null>(null);

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
    const ntrpMap: Record<string, number | null> = {};
    parts?.forEach((p: any) => {
      pMap[p.id] = p.profiles?.display_name || p.guest_name || '???';
    });

    // Fetch NTRP levels for all participants with user_ids
    const userParts = parts?.filter((p: any) => p.user_id) || [];
    if (userParts.length > 0) {
      const userIds = userParts.map((p: any) => p.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, ntrp_level')
        .in('id', userIds);
      const profileNtrpMap = new Map(profiles?.map((pr: any) => [pr.id, pr.ntrp_level]) || []);
      for (const p of userParts as any[]) {
        ntrpMap[p.id] = profileNtrpMap.get(p.user_id) ?? null;
      }
    }

    setParticipants(pMap);
    setParticipantNtrp(ntrpMap);
    setGames((gamesData as any) || []);

    // Calculate match MVP client-side
    const completedGames = ((gamesData as any) || []).filter(
      (g: GameWithDraw) => g.winner !== null
    );
    if (completedGames.length > 0) {
      const playerAgg: Record<string, { totalScore: number; gamesPlayed: number; wins: number; participantId: string }> = {};
      for (const g of completedGames as GameWithDraw[]) {
        const teamAPlayers = [g.team_a_player1_id, g.team_a_player2_id].filter(Boolean) as string[];
        const teamBPlayers = [g.team_b_player1_id, g.team_b_player2_id].filter(Boolean) as string[];

        for (const pid of teamAPlayers) {
          if (!playerAgg[pid]) playerAgg[pid] = { totalScore: 0, gamesPlayed: 0, wins: 0, participantId: pid };
          playerAgg[pid].gamesPlayed++;
          playerAgg[pid].totalScore += g.score_team_a ?? 0;
          if (g.winner === 'team_a') playerAgg[pid].wins++;
        }
        for (const pid of teamBPlayers) {
          if (!playerAgg[pid]) playerAgg[pid] = { totalScore: 0, gamesPlayed: 0, wins: 0, participantId: pid };
          playerAgg[pid].gamesPlayed++;
          playerAgg[pid].totalScore += g.score_team_b ?? 0;
          if (g.winner === 'team_b') playerAgg[pid].wins++;
        }
      }

      const sorted = Object.entries(playerAgg).sort((a, b) => {
        if (b[1].totalScore !== a[1].totalScore) return b[1].totalScore - a[1].totalScore;
        return b[1].gamesPlayed - a[1].gamesPlayed;
      });

      if (sorted.length > 0) {
        const [topPid, topAgg] = sorted[0];
        const topPart = parts?.find((p: any) => p.id === topPid);
        const userId = topPart?.user_id;

        // Get profile for avatar
        let avatarUrl: string | null = null;
        let ntrpLevel: number | null = null;
        if (userId) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('avatar_url, ntrp_level')
            .eq('id', userId)
            .single();
          avatarUrl = profile?.avatar_url || null;
          ntrpLevel = profile?.ntrp_level ?? null;
        }

        setMatchMvp({
          user_id: userId || topPid,
          display_name: pMap[topPid] || '???',
          avatar_url: avatarUrl,
          ntrp_level: ntrpLevel,
          total_score: topAgg.totalScore,
          games_played: topAgg.gamesPlayed,
          wins: topAgg.wins,
        });
      }
    } else {
      setMatchMvp(null);
    }

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
        {/* Match MVP */}
        {!loading && matchMvp && (
          <Card variant="glow" padding="md" className="relative overflow-hidden">
            <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#FFD740]/8 blur-xl pointer-events-none" />

            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-4 h-4 text-[#FFD740]" />
              <span className="text-sm font-bold text-[#FFD740]">
                이 경기의 MVP
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-[#FFD740]/15 blur-sm scale-110" />
                <Avatar
                  src={matchMvp.avatar_url}
                  alt={matchMvp.display_name}
                  fallback={matchMvp.display_name}
                  size="lg"
                  active
                />
                <Crown className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[#FFD740] drop-shadow-[0_0_4px_rgba(255,215,64,0.5)]" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-bold text-foreground truncate">
                    {matchMvp.display_name}
                  </p>
                  {matchMvp.ntrp_level && (
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                      {matchMvp.ntrp_level}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {matchMvp.total_score}점 | {matchMvp.wins}승 {matchMvp.games_played - matchMvp.wins}패
                </p>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-xl font-bold text-[#FFD740]">
                  {matchMvp.total_score}
                </p>
                <p className="text-[10px] text-muted-foreground">득점</p>
              </div>
            </div>
          </Card>
        )}

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
          <>
            {games.map((game) => (
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
            ))}

            {/* Fun Match Summary - shows when all games are completed */}
            <MatchSummary
              games={games}
              participantNames={participants}
              participantNtrp={participantNtrp}
            />
          </>
        )}
      </div>
    </>
  );
}
