'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TopBar } from '@/components/layout/top-bar';
import { submitScore } from '@/lib/actions/games';
import { createClient } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/utils/permissions';
import type { ClubRole } from '@/types';
import { EmptyState } from '@/components/ui/empty-state';
import { ResultsShareImage, type ResultsShareImageProps } from '@/components/match/results-share-image';
import { Trophy, RefreshCw, Crown, Share2, Download } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { cn } from '@/lib/utils/cn';
import { useToast } from '@/components/ui/toast-provider';

// ── Types ──

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

type MvpEntry = {
  participantId: string;
  userId: string | null;
  displayName: string;
  avatarUrl: string | null;
  ntrpLevel: number | null;
  totalScore: number;
  gamesPlayed: number;
  wins: number;
  avgScore: number;
};

type Highlight = {
  icon: string;
  label: string;
  description: string;
};

type FunStat = {
  label: string;
  value: string;
  sub?: string;
};

// ── Page ──

export default function ResultsPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const clubId = params.clubId as string;
  const toast = useToast();

  const [games, setGames] = useState<GameWithDraw[]>([]);
  const [participants, setParticipants] = useState<Record<string, string>>({});
  const [participantNtrp, setParticipantNtrp] = useState<Record<string, number | null>>({});
  const [editingGame, setEditingGame] = useState<string | null>(null);
  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [saving, setSaving] = useState(false);
  const [myRole, setMyRole] = useState<ClubRole | null>(null);
  const [loading, setLoading] = useState(true);

  // Computed
  const [mvpTop3, setMvpTop3] = useState<MvpEntry[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [funStats, setFunStats] = useState<FunStat[]>([]);
  const [matchTitle, setMatchTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [sharing, setSharing] = useState(false);

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
        .maybeSingle();
      setMyRole((membership?.role as ClubRole) || null);
    }

    // 매치 정보 조회
    const { data: matchData } = await supabase
      .from('matches')
      .select('title, match_date')
      .eq('id', matchId)
      .maybeSingle();
    if (matchData) {
      setMatchTitle(matchData.title || '');
      setMatchDate(matchData.match_date || '');
    }

    const { data: draws } = await supabase
      .from('draws')
      .select('id')
      .eq('match_id', matchId);

    if (!draws?.length) { setLoading(false); return; }

    const drawIds = draws.map((d) => d.id);
    const { data: gamesData } = await supabase
      .from('games')
      .select('*')
      .in('draw_id', drawIds)
      .order('game_order')
      .order('court_number');

    const { data: parts } = await supabase
      .from('match_participants')
      .select('id, user_id, guest_name, profiles:user_id (display_name, real_name, avatar_url, ntrp_level)')
      .eq('match_id', matchId);

    const pMap: Record<string, string> = {};
    const avatarMap: Record<string, string | null> = {};
    const ntrpMap: Record<string, number | null> = {};
    const userIdMap: Record<string, string | null> = {};

    parts?.forEach((p: any) => {
      const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
      const displayName = profile?.display_name || p.guest_name || '???';
      const realName = profile?.real_name;
      // 실명(닉네임) 형식, 실명 없으면 닉네임만
      pMap[p.id] = realName ? `${realName}(${displayName})` : displayName;
      avatarMap[p.id] = profile?.avatar_url || null;
      ntrpMap[p.id] = profile?.ntrp_level ?? null;
      userIdMap[p.id] = p.user_id || null;
    });

    setParticipants(pMap);
    setParticipantNtrp(ntrpMap);
    const allGames = (gamesData as GameWithDraw[]) || [];
    setGames(allGames);

    // 점수가 입력된 모든 경기 (무승부 포함)
    const completed = allGames.filter((g) => g.score_team_a !== null && g.score_team_b !== null);

    // ── Compute MVP Top 3 ──
    if (completed.length > 0) {
      const agg: Record<string, { totalScore: number; gamesPlayed: number; wins: number }> = {};
      for (const g of completed) {
        const teamA = [g.team_a_player1_id, g.team_a_player2_id].filter(Boolean) as string[];
        const teamB = [g.team_b_player1_id, g.team_b_player2_id].filter(Boolean) as string[];
        for (const pid of teamA) {
          if (!agg[pid]) agg[pid] = { totalScore: 0, gamesPlayed: 0, wins: 0 };
          agg[pid].gamesPlayed++;
          agg[pid].totalScore += g.score_team_a ?? 0;
          if (g.winner === 'team_a') agg[pid].wins++;
        }
        for (const pid of teamB) {
          if (!agg[pid]) agg[pid] = { totalScore: 0, gamesPlayed: 0, wins: 0 };
          agg[pid].gamesPlayed++;
          agg[pid].totalScore += g.score_team_b ?? 0;
          if (g.winner === 'team_b') agg[pid].wins++;
        }
      }

      const sorted = Object.entries(agg)
        .map(([pid, a]) => ({
          participantId: pid,
          userId: userIdMap[pid] || null,
          displayName: pMap[pid] || '???',
          avatarUrl: avatarMap[pid] || null,
          ntrpLevel: ntrpMap[pid] ?? null,
          totalScore: a.totalScore,
          gamesPlayed: a.gamesPlayed,
          wins: a.wins,
          avgScore: a.gamesPlayed > 0 ? Math.round((a.totalScore / a.gamesPlayed) * 10) / 10 : 0,
        }))
        .sort((a, b) => {
          if (b.avgScore !== a.avgScore) return b.avgScore - a.avgScore;
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          return b.wins - a.wins;
        });

      setMvpTop3(sorted.slice(0, 3));

      // ── Compute Highlights ──
      const hl: Highlight[] = [];

      // 최다 득점자
      if (sorted.length > 0) {
        hl.push({ icon: '🔥', label: '최다 득점', description: `${sorted[0].displayName} (${sorted[0].totalScore}점)` });
      }

      // 다승왕 (most wins)
      const mostWins = [...sorted].sort((a, b) => b.wins - a.wins)[0];
      if (mostWins && mostWins.wins > 0 && mostWins.participantId !== sorted[0]?.participantId) {
        hl.push({ icon: '🏆', label: '다승왕', description: `${mostWins.displayName} (${mostWins.wins}승)` });
      }

      // 가장 치열했던 경기
      let closestGame: GameWithDraw | null = null;
      let closestDiff = Infinity;
      for (const g of completed) {
        if (g.score_team_a !== null && g.score_team_b !== null) {
          const diff = Math.abs(g.score_team_a - g.score_team_b);
          if (diff < closestDiff || (diff === closestDiff && (g.score_team_a + g.score_team_b) > ((closestGame?.score_team_a ?? 0) + (closestGame?.score_team_b ?? 0)))) {
            closestDiff = diff;
            closestGame = g;
          }
        }
      }
      if (closestGame && closestGame.score_team_a !== null && closestGame.score_team_b !== null) {
        hl.push({ icon: '😰', label: '가장 치열한 경기', description: `${closestGame.game_order}경기 ${closestGame.court_number}코트 (${closestGame.score_team_a}:${closestGame.score_team_b})` });
      }

      // 압도적 승리
      let dominantGame: GameWithDraw | null = null;
      let dominantDiff = 0;
      for (const g of completed) {
        if (g.score_team_a !== null && g.score_team_b !== null) {
          const diff = Math.abs(g.score_team_a - g.score_team_b);
          if (diff > dominantDiff) { dominantDiff = diff; dominantGame = g; }
        }
      }
      if (dominantGame && dominantDiff >= 3 && dominantGame.score_team_a !== null && dominantGame.score_team_b !== null) {
        const winners = dominantGame.winner === 'team_a'
          ? [dominantGame.team_a_player1_id, dominantGame.team_a_player2_id]
          : [dominantGame.team_b_player1_id, dominantGame.team_b_player2_id];
        const names = winners.filter(Boolean).map((id) => pMap[id!] || '???').join(', ');
        hl.push({ icon: '💪', label: '압도적 승리', description: `${names} (${dominantGame.score_team_a}:${dominantGame.score_team_b})` });
      }

      // 철인 선수 (most games played)
      const maxGames = Math.max(...sorted.map((s) => s.gamesPlayed));
      const avgGames = sorted.reduce((sum, s) => sum + s.gamesPlayed, 0) / sorted.length;
      if (maxGames > avgGames) {
        const ironPlayers = sorted.filter((s) => s.gamesPlayed === maxGames);
        hl.push({ icon: '🏃', label: '철인 선수', description: `${ironPlayers.map((p) => p.displayName).join(', ')} (${maxGames}경기)` });
      }

      // 연승 기록
      const streaks: { name: string; streak: number }[] = [];
      for (const [pid] of Object.entries(agg)) {
        const playerGames = completed
          .filter((g) => [g.team_a_player1_id, g.team_a_player2_id, g.team_b_player1_id, g.team_b_player2_id].includes(pid))
          .sort((a, b) => a.game_order - b.game_order || a.court_number - b.court_number);
        let maxStreak = 0, current = 0;
        for (const g of playerGames) {
          const isTeamA = [g.team_a_player1_id, g.team_a_player2_id].includes(pid);
          const won = (isTeamA && g.winner === 'team_a') || (!isTeamA && g.winner === 'team_b');
          if (won) { current++; maxStreak = Math.max(maxStreak, current); }
          else { current = 0; }
        }
        if (maxStreak >= 3) streaks.push({ name: pMap[pid] || '???', streak: maxStreak });
      }
      if (streaks.length > 0) {
        const best = streaks.sort((a, b) => b.streak - a.streak)[0];
        hl.push({ icon: '⚡', label: '연승 기록', description: `${best.name} (${best.streak}연승)` });
      }

      setHighlights(hl.slice(0, 6));

      // ── Compute Fun Stats ──
      const stats: FunStat[] = [];
      const totalPoints = completed.reduce((sum, g) => sum + (g.score_team_a ?? 0) + (g.score_team_b ?? 0), 0);
      stats.push({ label: '오늘 총 득점', value: `${totalPoints}점`, sub: `${completed.length}경기 합산` });

      const shutouts = completed.filter((g) => g.score_team_a === 0 || g.score_team_b === 0).length;
      stats.push({ label: '완봉승', value: shutouts > 0 ? `${shutouts}경기` : '없음' });

      const closeGames = completed.filter((g) => g.score_team_a !== null && g.score_team_b !== null && Math.abs(g.score_team_a - g.score_team_b) <= 1).length;
      const closeRate = completed.length > 0 ? Math.round((closeGames / completed.length) * 100) : 0;
      stats.push({ label: '접전율', value: `${closeRate}%`, sub: '1점차 이내' });

      stats.push({ label: '참여 선수', value: `${Object.keys(agg).length}명` });

      setFunStats(stats);
    } else {
      setMvpTop3([]);
      setHighlights([]);
      setFunStats([]);
    }

    setLoading(false);
  }, [matchId, clubId]);

  useEffect(() => { loadData(); }, [loadData]);

  const getName = (id: string | null) => id ? participants[id] || '???' : '-';

  // ── Image share ──
  const handleShare = async () => {
    setSharing(true);
    try {
      const html2canvasModule = await import('html2canvas').catch(() => null);
      if (!html2canvasModule) { toast.error('이미지 생성 라이브러리를 로드할 수 없습니다.'); return; }
      const html2canvas = html2canvasModule.default;

      const completed = games.filter((g) => g.score_team_a !== null && g.score_team_b !== null);
      const gameResults = completed.map((g) => ({
        gameOrder: g.game_order,
        courtNumber: g.court_number,
        teamANames: [g.team_a_player1_id, g.team_a_player2_id].filter(Boolean).map((id) => getName(id)).join(', '),
        teamBNames: [g.team_b_player1_id, g.team_b_player2_id].filter(Boolean).map((id) => getName(id)).join(', '),
        scoreA: g.score_team_a ?? 0,
        scoreB: g.score_team_b ?? 0,
        winner: g.winner,
      }));

      const props: ResultsShareImageProps = { matchTitle, matchDate, mvpTop3, highlights, funStats, gameResults };

      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position:fixed;left:-9999px;top:0;width:1080px;z-index:-1;pointer-events:none;';
      document.body.appendChild(tempContainer);

      let root: ReturnType<typeof createRoot> | null = null;
      try {
        root = createRoot(tempContainer);
        flushSync(() => { root!.render(createElement(ResultsShareImage, props)); });
        await new Promise((r) => setTimeout(r, 300));

        const target = tempContainer.firstElementChild as HTMLElement;
        if (!target) { toast.error('이미지를 생성할 수 없습니다'); return; }

        const canvas = await html2canvas(target, { backgroundColor: '#0F0F0F', scale: 1, useCORS: true, logging: false });
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) { toast.error('이미지 변환에 실패했습니다'); return; }

        const fileName = `경기결과_${matchTitle}.png`;
        const file = new File([blob], fileName, { type: 'image/png' });

        // 모바일에서만 Web Share API 시도
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile && navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: `${matchTitle} 경기 결과` });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          toast.success('이미지가 다운로드되었습니다');
        }
      } finally {
        root?.unmount();
        document.body.removeChild(tempContainer);
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        console.error('Results share failed:', e);
        toast.error('이미지 공유에 실패했습니다');
      }
    } finally {
      setSharing(false);
    }
  };

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
      toast.error(e instanceof Error ? e.message : '점수 저장에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  // ── Medal colors ──
  const medalColors = [
    { accent: '#FFD740', ring: 'ring-[#FFD740]/50', border: 'border-[#FFD740]/30', emoji: '👑' },
    { accent: '#C0C0C0', ring: 'ring-[#C0C0C0]/40', border: 'border-[#C0C0C0]/20', emoji: '🥈' },
    { accent: '#CD7F32', ring: 'ring-[#CD7F32]/40', border: 'border-[#CD7F32]/20', emoji: '🥉' },
  ];

  // ── Group games by game_order (time slot) ──
  const gamesBySlot = games.reduce<Record<number, GameWithDraw[]>>((acc, g) => {
    if (!acc[g.game_order]) acc[g.game_order] = [];
    acc[g.game_order].push(g);
    return acc;
  }, {});
  const slotOrders = Object.keys(gamesBySlot).map(Number).sort((a, b) => a - b);

  return (
    <>
      <TopBar title="경기 결과" backHref={`/clubs/${clubId}/matches/${matchId}`} />

      <div className="px-4 py-4 space-y-6 animate-fade-in">
        {/* 공유 버튼 */}
        {!loading && games.length > 0 && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleShare}
              disabled={sharing}
              className="gap-1.5"
            >
              {sharing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
              {sharing ? '생성 중...' : '결과 공유'}
            </Button>
          </div>
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
            {/* ═══ Section 1: MVP Top 3 ═══ */}
            {mvpTop3.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🏆</span>
                  <h2 className="text-xl font-bold text-foreground">오늘의 MVP</h2>
                </div>

                {/* 1st place */}
                <Card variant="glow" padding="lg" className={cn('relative overflow-hidden mb-3', medalColors[0].border)}>
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FFD740] via-[#FFA000] to-[#FFD740]" />
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">{medalColors[0].emoji}</span>
                    <div className={cn('ring-2 ring-offset-2 ring-offset-background rounded-full', medalColors[0].ring)}>
                      <Avatar src={mvpTop3[0].avatarUrl} alt={mvpTop3[0].displayName} fallback={mvpTop3[0].displayName} size="xl" />
                    </div>
                    <p className="text-lg font-bold text-foreground">{mvpTop3[0].displayName}</p>
                    {mvpTop3[0].ntrpLevel && <Badge variant="warning">NTRP {mvpTop3[0].ntrpLevel}</Badge>}
                  </div>
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#FFD740]/10">
                    <div className="text-center">
                      <p className="text-[11px] text-muted-foreground">평균 득점</p>
                      <p className="text-xl font-bold" style={{ color: '#FFD740' }}>{mvpTop3[0].avgScore}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-muted-foreground">승수</p>
                      <p className="text-xl font-bold text-primary">{mvpTop3[0].wins}승</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[11px] text-muted-foreground">총 득점</p>
                      <p className="text-xl font-bold text-foreground">{mvpTop3[0].totalScore}</p>
                    </div>
                  </div>
                </Card>

                {/* 2nd & 3rd */}
                {mvpTop3.length >= 2 && (
                  <div className="grid grid-cols-2 gap-3">
                    {mvpTop3.slice(1, 3).map((mvp, i) => {
                      const medal = medalColors[i + 1];
                      return (
                        <Card key={mvp.participantId} variant="glass" padding="md" className={cn('relative overflow-hidden', medal.border)}>
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent to-transparent" style={{ background: `linear-gradient(to right, transparent, ${medal.accent}, transparent)` }} />
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-lg">{medal.emoji}</span>
                            <div className={cn('ring-2 ring-offset-1 ring-offset-background rounded-full', medal.ring)}>
                              <Avatar src={mvp.avatarUrl} alt={mvp.displayName} fallback={mvp.displayName} size="lg" />
                            </div>
                            <p className="text-sm font-semibold text-foreground mt-1">{mvp.displayName}</p>
                            {mvp.ntrpLevel && (
                              <Badge variant="outline" className="text-[10px]" style={{ borderColor: `${medal.accent}40`, color: medal.accent }}>
                                NTRP {mvp.ntrpLevel}
                              </Badge>
                            )}
                          </div>
                          <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-white/[0.06]">
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground">평균</p>
                              <p className="text-base font-bold" style={{ color: medal.accent }}>{mvp.avgScore}</p>
                            </div>
                            <div className="text-center">
                              <p className="text-[10px] text-muted-foreground">승수</p>
                              <p className="text-base font-bold text-primary">{mvp.wins}승</p>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ═══ Section 2: Highlights ═══ */}
            {highlights.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-3">오늘의 명장면</h2>
                <Card variant="glass" padding="sm" className="divide-y divide-white/[0.04]">
                  {highlights.map((h, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5">
                      <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center flex-shrink-0 text-base">
                        {h.icon}
                      </div>
                      <p className="text-sm text-foreground flex-1">
                        <span className="text-muted-foreground">{h.label}: </span>
                        <span className="font-semibold">{h.description}</span>
                      </p>
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* ═══ Section 3: Fun Stats ═══ */}
            {funStats.length > 0 && (
              <div>
                <h2 className="text-lg font-bold text-foreground mb-3">재미있는 통계</h2>
                <div className="grid grid-cols-2 gap-3">
                  {funStats.map((stat, i) => (
                    <Card key={i} variant={i === 0 ? 'glow' : 'glass'} padding="md" className="text-center">
                      <p className="text-[11px] text-muted-foreground">{stat.label}</p>
                      <p className={cn('text-2xl font-bold mt-1', i === 0 ? 'text-primary' : 'text-foreground')}>{stat.value}</p>
                      {stat.sub && <p className="text-[10px] text-muted-foreground mt-0.5">{stat.sub}</p>}
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Section 4: Game Results ═══ */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-3">게임별 결과</h2>
              {slotOrders.map((order) => {
                const slotGames = gamesBySlot[order].sort((a, b) => a.court_number - b.court_number);
                return (
                  <div key={order} className="mb-4 last:mb-0">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <p className="text-xs font-medium text-muted-foreground">{order}경기</p>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    <div className="space-y-2">
                      {slotGames.map((game) => (
                        <Card key={game.id} padding="sm" className="transition-all">
                          {/* Court label */}
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-[10px]">{game.court_number}코트</Badge>
                            {game.winner && <Trophy className="w-3.5 h-3.5 text-primary/60" />}
                          </div>

                          {/* Score row */}
                          {editingGame === game.id ? (
                            <div>
                              <div className="flex items-center justify-center gap-3 mb-3">
                                <div className="flex flex-col items-center gap-0.5">
                                  <button onClick={() => setScoreA((s) => s + 1)} className="w-9 h-7 text-xs bg-surface-elevated rounded-lg border border-border text-foreground cursor-pointer">+</button>
                                  <span className="text-xl font-bold w-9 text-center">{scoreA}</span>
                                  <button onClick={() => setScoreA((s) => Math.max(0, s - 1))} className="w-9 h-7 text-xs bg-surface-elevated rounded-lg border border-border text-foreground cursor-pointer">-</button>
                                </div>
                                <span className="text-muted-foreground font-bold">:</span>
                                <div className="flex flex-col items-center gap-0.5">
                                  <button onClick={() => setScoreB((s) => s + 1)} className="w-9 h-7 text-xs bg-surface-elevated rounded-lg border border-border text-foreground cursor-pointer">+</button>
                                  <span className="text-xl font-bold w-9 text-center">{scoreB}</span>
                                  <button onClick={() => setScoreB((s) => Math.max(0, s - 1))} className="w-9 h-7 text-xs bg-surface-elevated rounded-lg border border-border text-foreground cursor-pointer">-</button>
                                </div>
                              </div>
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="ghost" onClick={() => setEditingGame(null)}>취소</Button>
                                <Button size="sm" onClick={() => handleSave(game.id)} disabled={saving}>{saving ? '저장 중...' : '저장'}</Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center">
                              {/* Team A */}
                              <div className="flex-1 text-right">
                                <p className={cn('text-sm', game.winner === 'team_a' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                                  {getName(game.team_a_player1_id)}
                                </p>
                                {game.team_a_player2_id && (
                                  <p className={cn('text-xs', game.winner === 'team_a' ? 'text-foreground/70' : 'text-muted-foreground')}>
                                    {getName(game.team_a_player2_id)}
                                  </p>
                                )}
                              </div>
                              {/* Score */}
                              <div className="min-w-[60px] text-center px-2">
                                {game.score_team_a !== null ? (
                                  <span className="font-bold text-base tabular-nums">
                                    <span className={game.winner === 'team_a' ? 'text-primary' : 'text-muted-foreground'}>{game.score_team_a}</span>
                                    <span className="text-subtle mx-1">:</span>
                                    <span className={game.winner === 'team_b' ? 'text-primary' : 'text-muted-foreground'}>{game.score_team_b}</span>
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-muted-foreground">미입력</span>
                                )}
                              </div>
                              {/* Team B */}
                              <div className="flex-1">
                                <p className={cn('text-sm', game.winner === 'team_b' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                                  {getName(game.team_b_player1_id)}
                                </p>
                                {game.team_b_player2_id && (
                                  <p className={cn('text-xs', game.winner === 'team_b' ? 'text-foreground/70' : 'text-muted-foreground')}>
                                    {getName(game.team_b_player2_id)}
                                  </p>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Edit button */}
                          {canInputResult && editingGame !== game.id && (
                            <div className="mt-2 pt-2 border-t border-border flex justify-end">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(game)}>
                                {game.score_team_a !== null ? '수정' : '점수 입력'}
                              </Button>
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}
