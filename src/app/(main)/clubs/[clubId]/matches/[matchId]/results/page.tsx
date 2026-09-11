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
import { Trophy, RefreshCw, Crown, Share2, Download, X, Minus, Plus } from 'lucide-react';
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
  losses: number;
  avgScore: number;
  rank: number;
  tied: boolean;
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
  // 공유 이미지의 '선수별 결과'용 전체 순위 (게임별 결과 대체 — 이미지 길이 축소)
  const [allPlayers, setAllPlayers] = useState<MvpEntry[]>([]);
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [funStats, setFunStats] = useState<FunStat[]>([]);
  const [matchTitle, setMatchTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');
  const [clubName, setClubName] = useState('');
  const [clubLogoUrl, setClubLogoUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareBlob, setShareBlob] = useState<Blob | null>(null);

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

    // 공유 이미지 브랜딩용 클럽 정보
    const { data: clubData } = await supabase
      .from('clubs')
      .select('name, logo_url')
      .eq('id', clubId)
      .maybeSingle();
    if (clubData) {
      setClubName(clubData.name || '');
      setClubLogoUrl(clubData.logo_url || null);
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
      const agg: Record<string, { totalScore: number; gamesPlayed: number; wins: number; losses: number }> = {};
      for (const g of completed) {
        const teamA = [g.team_a_player1_id, g.team_a_player2_id].filter(Boolean) as string[];
        const teamB = [g.team_b_player1_id, g.team_b_player2_id].filter(Boolean) as string[];
        for (const pid of teamA) {
          if (!agg[pid]) agg[pid] = { totalScore: 0, gamesPlayed: 0, wins: 0, losses: 0 };
          agg[pid].gamesPlayed++;
          agg[pid].totalScore += g.score_team_a ?? 0;
          if (g.winner === 'team_a') agg[pid].wins++;
          else if (g.winner === 'team_b') agg[pid].losses++;
        }
        for (const pid of teamB) {
          if (!agg[pid]) agg[pid] = { totalScore: 0, gamesPlayed: 0, wins: 0, losses: 0 };
          agg[pid].gamesPlayed++;
          agg[pid].totalScore += g.score_team_b ?? 0;
          if (g.winner === 'team_b') agg[pid].wins++;
          else if (g.winner === 'team_a') agg[pid].losses++;
        }
      }

      const ranked = Object.entries(agg)
        .map(([pid, a]) => ({
          participantId: pid,
          userId: userIdMap[pid] || null,
          displayName: pMap[pid] || '???',
          avatarUrl: avatarMap[pid] || null,
          ntrpLevel: ntrpMap[pid] ?? null,
          totalScore: a.totalScore,
          gamesPlayed: a.gamesPlayed,
          wins: a.wins,
          losses: a.losses,
          avgScore: a.gamesPlayed > 0 ? Math.round((a.totalScore / a.gamesPlayed) * 10) / 10 : 0,
        }))
        // 승리 우선, 같으면 득점(총득점) 우선. 평균 득점은 최종 표시 순서용.
        .sort((a, b) => {
          if (b.wins !== a.wins) return b.wins - a.wins;
          if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
          return b.avgScore - a.avgScore;
        });

      // 공동 순위(경쟁 순위 1,1,3…) — (승수, 총득점)이 모두 같아야 동점.
      const keyCount: Record<string, number> = {};
      ranked.forEach((e) => {
        const k = `${e.wins}|${e.totalScore}`;
        keyCount[k] = (keyCount[k] || 0) + 1;
      });
      const sorted: MvpEntry[] = ranked.map((e) => {
        const rank = 1 + ranked.filter(
          (o) => o.wins > e.wins || (o.wins === e.wins && o.totalScore > e.totalScore)
        ).length;
        return { ...e, rank, tied: keyCount[`${e.wins}|${e.totalScore}`] > 1 };
      });

      // 공동 순위 포함 — 3위 이내(공동 포함)는 전원 표시
      setMvpTop3(sorted.filter((e) => e.rank <= 3));
      setAllPlayers(sorted);

      // ── Compute Highlights (동점자는 모두 나열) ──
      const hl: Highlight[] = [];
      const nameList = (arr: { displayName: string }[]) => arr.map((p) => p.displayName).join(', ');

      // 최다 득점 — 동점 전원
      const maxScore = Math.max(...sorted.map((s) => s.totalScore));
      const topScorers = sorted.filter((s) => s.totalScore === maxScore);
      if (maxScore > 0) {
        hl.push({ icon: '🔥', label: '최다 득점', description: `${nameList(topScorers)} (${maxScore}점)` });
      }

      // 다승왕 — 동점 전원. 최다 득점자 집합과 완전히 같으면 중복이라 생략
      const maxWinCount = Math.max(...sorted.map((s) => s.wins));
      const winKings = sorted.filter((s) => s.wins === maxWinCount);
      const sameAsScorers =
        winKings.length === topScorers.length &&
        winKings.every((w) => topScorers.some((t) => t.participantId === w.participantId));
      if (maxWinCount > 0 && !sameAsScorers) {
        hl.push({ icon: '🏆', label: '다승왕', description: `${nameList(winKings)} (${maxWinCount}승)` });
      }

      // 가장 치열한 경기 — 최소 점수차 경기 모두
      const diffOf = (g: GameWithDraw) => Math.abs((g.score_team_a ?? 0) - (g.score_team_b ?? 0));
      const minDiff = Math.min(...completed.map(diffOf));
      const closestGames = completed.filter((g) => diffOf(g) === minDiff);
      if (closestGames.length > 0) {
        const desc = closestGames
          .map((g) => `${g.game_order}경기 ${g.court_number}코트 (${g.score_team_a}:${g.score_team_b})`)
          .join(', ');
        hl.push({ icon: '😰', label: '가장 치열한 경기', description: desc });
      }

      // 압도적 승리 — 최대 점수차(3점 이상) 경기 모두, 승리 팀 이름으로
      const maxDiff = Math.max(...completed.map(diffOf));
      if (maxDiff >= 3) {
        const dominantGames = completed.filter((g) => diffOf(g) === maxDiff && g.winner);
        if (dominantGames.length > 0) {
          const desc = dominantGames
            .map((g) => {
              const winners = (g.winner === 'team_a'
                ? [g.team_a_player1_id, g.team_a_player2_id]
                : [g.team_b_player1_id, g.team_b_player2_id]
              ).filter(Boolean).map((id) => pMap[id!] || '???').join('·');
              return `${winners} (${g.score_team_a}:${g.score_team_b})`;
            })
            .join(', ');
          hl.push({ icon: '💪', label: '압도적 승리', description: desc });
        }
      }

      // 환상의 페어 — 같은 팀 조합으로 2승 이상 (동률 모두)
      const pairWins: Record<string, { ids: string[]; wins: number }> = {};
      for (const g of completed) {
        if (!g.winner) continue;
        const winIds = (g.winner === 'team_a'
          ? [g.team_a_player1_id, g.team_a_player2_id]
          : [g.team_b_player1_id, g.team_b_player2_id]
        ).filter(Boolean) as string[];
        if (winIds.length === 2) {
          const key = [...winIds].sort().join('|');
          if (!pairWins[key]) pairWins[key] = { ids: winIds, wins: 0 };
          pairWins[key].wins++;
        }
      }
      const pairArr = Object.values(pairWins);
      if (pairArr.length > 0) {
        const maxPairWins = Math.max(...pairArr.map((p) => p.wins));
        if (maxPairWins >= 2) {
          const bestPairs = pairArr.filter((p) => p.wins === maxPairWins);
          const desc = bestPairs
            .map((p) => `${pMap[p.ids[0]] || '???'}·${pMap[p.ids[1]] || '???'}`)
            .join(', ');
          hl.push({ icon: '💚', label: '환상의 페어', description: `${desc} (${maxPairWins}승)` });
        }
      }

      // 철인 선수 — 최다 경기 전원 (기존부터 전원 표시)
      const maxGames = Math.max(...sorted.map((s) => s.gamesPlayed));
      const avgGames = sorted.reduce((sum, s) => sum + s.gamesPlayed, 0) / sorted.length;
      if (maxGames > avgGames) {
        const ironPlayers = sorted.filter((s) => s.gamesPlayed === maxGames);
        hl.push({ icon: '🏃', label: '철인 선수', description: `${nameList(ironPlayers)} (${maxGames}경기)` });
      }

      // 연승 기록 — 동률 전원
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
        const bestStreak = Math.max(...streaks.map((s) => s.streak));
        const bests = streaks.filter((s) => s.streak === bestStreak);
        hl.push({ icon: '⚡', label: '연승 기록', description: `${bests.map((b) => b.name).join(', ')} (${bestStreak}연승)` });
      }

      setHighlights(hl.slice(0, 7));

      // ── Compute Fun Stats ──
      const stats: FunStat[] = [];
      const totalPoints = completed.reduce((sum, g) => sum + (g.score_team_a ?? 0) + (g.score_team_b ?? 0), 0);
      stats.push({ label: '오늘 총 득점', value: `${totalPoints}점`, sub: `${completed.length}경기 합산` });

      const closeGames = completed.filter((g) => g.score_team_a !== null && g.score_team_b !== null && Math.abs(g.score_team_a - g.score_team_b) <= 1).length;
      const closeRate = completed.length > 0 ? Math.round((closeGames / completed.length) * 100) : 0;
      stats.push({ label: '접전율', value: `${closeRate}%`, sub: '1점차 이내' });

      // 최다 득점 경기 (완봉승 대체 — 더 보편적으로 재미있는 지표)
      const highestGame = completed.reduce<GameWithDraw | null>(
        (best, g) => ((g.score_team_a ?? 0) + (g.score_team_b ?? 0) > (best ? (best.score_team_a ?? 0) + (best.score_team_b ?? 0) : -1) ? g : best),
        null,
      );
      stats.push({
        label: '최다 득점 경기',
        value: highestGame ? `${highestGame.score_team_a}:${highestGame.score_team_b}` : '-',
        sub: highestGame ? `${highestGame.game_order}경기 ${highestGame.court_number}코트` : undefined,
      });

      stats.push({ label: '참여 선수', value: `${Object.keys(agg).length}명` });

      setFunStats(stats);
    } else {
      setMvpTop3([]);
      setAllPlayers([]);
      setHighlights([]);
      setFunStats([]);
    }

    setLoading(false);
  }, [matchId, clubId]);

  useEffect(() => { loadData(); }, [loadData]);

  const getName = (id: string | null) => id ? participants[id] || '???' : '-';

  // 아바타 URL을 data URL로 변환 — html2canvas가 외부 이미지로 캔버스를 오염(taint)시켜
  // toBlob이 통째로 실패하는 것을 방지. 실패 시 null → 공유 이미지에서 이니셜 폴백.
  const toDataUrl = async (url: string | null): Promise<string | null> => {
    if (!url) return null;
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (!res.ok) return null;
      const blob = await res.blob();
      return await new Promise<string | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // ── Image share (2-step: generate → share from fresh user gesture) ──
  const handleGenerateImage = async () => {
    setSharing(true);
    try {
      const html2canvasModule = await import('html2canvas').catch(() => null);
      if (!html2canvasModule) { toast.error('이미지 생성 라이브러리를 로드할 수 없습니다.'); return; }
      const html2canvas = html2canvasModule.default;

      // 게임별 결과 대신 '선수별 결과' — 이미지가 지나치게 길어지는 문제 해결
      const playerResults = allPlayers.map((p) => ({
        displayName: p.displayName,
        wins: p.wins,
        losses: p.losses,
        totalScore: p.totalScore,
        rank: p.rank,
        tied: p.tied,
      }));

      // MVP 아바타를 data URL로 선변환(앱 화면과 동일하게 사진 표시)
      const mvpForImage = await Promise.all(
        mvpTop3.map(async (m) => ({
          displayName: m.displayName,
          avatarDataUrl: await toDataUrl(m.avatarUrl),
          ntrpLevel: m.ntrpLevel,
          avgScore: m.avgScore,
          wins: m.wins,
          totalScore: m.totalScore,
          gamesPlayed: m.gamesPlayed,
          rank: m.rank,
          tied: m.tied,
        }))
      );

      const clubLogoDataUrl = await toDataUrl(clubLogoUrl);

      const props: ResultsShareImageProps = { clubName, clubLogoDataUrl, matchTitle, matchDate, mvpTop3: mvpForImage, highlights, funStats, playerResults };

      const tempContainer = document.createElement('div');
      tempContainer.style.cssText = 'position:absolute;left:-2000px;top:0;pointer-events:none;';
      document.body.appendChild(tempContainer);

      let root: ReturnType<typeof createRoot> | null = null;
      try {
        root = createRoot(tempContainer);
        flushSync(() => { root!.render(createElement(ResultsShareImage, props)); });
        await new Promise<void>((r) => { requestAnimationFrame(() => requestAnimationFrame(() => r())); });
        await new Promise((r) => setTimeout(r, 100));

        const target = tempContainer.firstElementChild as HTMLElement;
        if (!target) { toast.error('이미지를 생성할 수 없습니다'); return; }

        const canvas = await html2canvas(target, {
          backgroundColor: '#0A0A0A',
          scale: 2,
          useCORS: true,
          logging: false,
          windowWidth: 1200,
          // scale 캡처 시 소수점 높이 반올림으로 하단이 잘리는 문제 방지
          height: Math.ceil(target.scrollHeight),
          windowHeight: Math.ceil(target.scrollHeight) + 100,
        });
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
        if (!blob) { toast.error('이미지 변환에 실패했습니다'); return; }

        setShareBlob(blob);
      } finally {
        root?.unmount();
        document.body.removeChild(tempContainer);
      }
    } catch (e) {
      console.error('Image generation failed:', e);
      toast.error('이미지 생성에 실패했습니다');
    } finally {
      setSharing(false);
    }
  };

  // Called directly from user tap — navigator.share works
  const handleShareBlob = async () => {
    if (!shareBlob) return;
    const fileName = `경기결과_${matchTitle}.png`;
    const file = new File([shareBlob], fileName, { type: 'image/png' });
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] });
      } else {
        const url = URL.createObjectURL(shareBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        const url = URL.createObjectURL(shareBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    }
    setShareBlob(null);
  };

  const handleDownloadBlob = () => {
    if (!shareBlob) return;
    const fileName = `경기결과_${matchTitle}.png`;
    const url = URL.createObjectURL(shareBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
    setShareBlob(null);
  };

  const handleEdit = (game: GameWithDraw) => {
    setEditingGame(game.id);
    setScoreA(game.score_team_a || 0);
    setScoreB(game.score_team_b || 0);
  };

  // 점수 직접 입력 — 숫자 외 문자 제거, 0~99 범위로 제한
  const handleScoreInput = (setter: (v: number) => void, value: string) => {
    const digits = value.replace(/\D/g, '');
    setter(digits === '' ? 0 : Math.min(99, parseInt(digits, 10)));
  };

  const handleSave = async (gameId: string) => {
    setSaving(true);
    try {
      const res = await submitScore(gameId, scoreA, scoreB);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      // 저장 성공 → 표시 순서상 다음 미입력 경기로 자동 이동 (없으면 편집 종료)
      const ordered = [...games].sort(
        (a, b) => a.game_order - b.game_order || a.court_number - b.court_number
      );
      const savedIdx = ordered.findIndex((g) => g.id === gameId);
      const nextGame = [...ordered.slice(savedIdx + 1), ...ordered.slice(0, savedIdx)].find(
        (g) => g.score_team_a === null
      );
      if (nextGame) {
        setEditingGame(nextGame.id);
        setScoreA(0);
        setScoreB(nextGame.score_team_b ?? 0);
      } else {
        setEditingGame(null);
      }
      await loadData();
      if (nextGame) {
        // 리렌더 완료 후 다음 경기 카드를 화면 중앙으로 스크롤
        setTimeout(() => {
          document
            .getElementById(`game-card-${nextGame.id}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 150);
      }
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
              onClick={handleGenerateImage}
              disabled={sharing}
              className="gap-1.5"
            >
              {sharing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
              {sharing ? '생성 중...' : '결과 공유'}
            </Button>
          </div>
        )}

        {/* 공유 모달 — 이미지 생성 후 유저 탭으로 공유 */}
        {shareBlob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-6" onClick={() => setShareBlob(null)}>
            <div
              className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <p className="text-sm font-semibold text-foreground">경기 결과 이미지</p>
                <button onClick={() => setShareBlob(null)} className="text-muted-foreground hover:text-foreground p-1 -mr-1">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-4">
                <img
                  src={URL.createObjectURL(shareBlob)}
                  alt="경기 결과"
                  className="w-full max-h-[45vh] object-contain rounded-xl border border-border bg-black"
                />
              </div>
              <div className="flex gap-2 p-4">
                <Button variant="secondary" fullWidth onClick={handleDownloadBlob} className="gap-1.5">
                  <Download className="w-4 h-4" />
                  저장
                </Button>
                <Button variant="primary" fullWidth onClick={handleShareBlob} className="gap-1.5">
                  <Share2 className="w-4 h-4" />
                  공유
                </Button>
              </div>
            </div>
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
            {/* ═══ Section 1: MVP (공동 순위 전원 표시) ═══ */}
            {mvpTop3.length > 0 && (() => {
              const firstGroup = mvpTop3.filter((e) => e.rank === 1);
              const restGroup = mvpTop3.filter((e) => e.rank > 1);
              return (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🏆</span>
                  <h2 className="text-xl font-bold text-foreground">오늘의 MVP</h2>
                </div>

                {/* 1위 그룹 — 공동 1위면 나란히 (전원 금색 카드) */}
                <div className={cn('gap-3 mb-3', firstGroup.length > 1 ? 'grid grid-cols-2' : '')}>
                  {firstGroup.map((first) => (
                    <Card key={first.participantId} variant="glow" padding={firstGroup.length > 1 ? 'md' : 'lg'} className={cn('relative overflow-hidden', medalColors[0].border)}>
                      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#FFD740] via-[#FFA000] to-[#FFD740]" />
                      <div className="flex flex-col items-center gap-2">
                        <span className={firstGroup.length > 1 ? 'text-2xl' : 'text-3xl'}>{medalColors[0].emoji}</span>
                        <div className={cn('ring-2 ring-offset-2 ring-offset-background rounded-full', medalColors[0].ring)}>
                          <Avatar src={first.avatarUrl} alt={first.displayName} fallback={first.displayName} size={firstGroup.length > 1 ? 'lg' : 'xl'} />
                        </div>
                        <span className="text-xs font-extrabold tracking-wide" style={{ color: '#FFD740' }}>
                          {first.tied ? '공동 ' : ''}{first.rank}위
                        </span>
                        <p className="text-lg font-bold text-foreground truncate max-w-full">{first.displayName}</p>
                      </div>
                      <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[#FFD740]/10">
                        <div className="text-center">
                          <p className="text-[11px] text-muted-foreground">평균 득점</p>
                          <p className="text-xl font-bold" style={{ color: '#FFD740' }}>{first.avgScore}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] text-muted-foreground">승수</p>
                          <p className="text-xl font-bold text-primary">{first.wins}승</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[11px] text-muted-foreground">총 득점</p>
                          <p className="text-xl font-bold text-foreground">{first.totalScore}</p>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>

                {/* 2·3위 그룹 — 공동 포함 전원 */}
                {restGroup.length > 0 && (
                  <div className="grid grid-cols-2 gap-3">
                    {restGroup.map((mvp) => {
                      const medal = medalColors[Math.min(mvp.rank - 1, 2)];
                      return (
                        <Card key={mvp.participantId} variant="glass" padding="md" className={cn('relative overflow-hidden', medal.border)}>
                          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent to-transparent" style={{ background: `linear-gradient(to right, transparent, ${medal.accent}, transparent)` }} />
                          <div className="flex flex-col items-center gap-1.5">
                            <span className="text-lg">{medal.emoji}</span>
                            <div className={cn('ring-2 ring-offset-1 ring-offset-background rounded-full', medal.ring)}>
                              <Avatar src={mvp.avatarUrl} alt={mvp.displayName} fallback={mvp.displayName} size="lg" />
                            </div>
                            <span className="text-[11px] font-bold tracking-wide" style={{ color: medal.accent }}>
                              {mvp.tied ? '공동 ' : ''}{mvp.rank}위
                            </span>
                            <p className="text-sm font-semibold text-foreground mt-1 truncate max-w-full">{mvp.displayName}</p>
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
              );
            })()}

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
                        <Card key={game.id} id={`game-card-${game.id}`} padding="sm" className="transition-all">
                          {/* Court label */}
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="outline" className="text-[10px]">{game.court_number}코트</Badge>
                            {game.winner && <Trophy className="w-3.5 h-3.5 text-primary/60" />}
                          </div>

                          {/* Score row */}
                          {editingGame === game.id ? (
                            <div>
                              <div className="flex items-center justify-center gap-2 mb-3">
                                {/* Team A */}
                                <div className="flex-1 min-w-0 text-center">
                                  <p className="text-[10px] text-muted-foreground mb-1.5 truncate">
                                    {[game.team_a_player1_id, game.team_a_player2_id].filter(Boolean).map((id) => getName(id)).join(', ')}
                                  </p>
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setScoreA((s) => Math.max(0, s - 1))}
                                      aria-label="A팀 점수 내리기"
                                      className="w-9 h-11 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer active:scale-95"
                                    >
                                      <Minus className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      autoFocus
                                      value={scoreA}
                                      onChange={(e) => handleScoreInput(setScoreA, e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      aria-label="A팀 점수"
                                      className="w-12 h-11 text-center text-xl font-bold tabular-nums rounded-xl bg-muted border border-border text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setScoreA((s) => Math.min(99, s + 1))}
                                      aria-label="A팀 점수 올리기"
                                      className="w-9 h-11 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer active:scale-95"
                                    >
                                      <Plus className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                  </div>
                                </div>
                                <span className="text-muted-foreground font-bold mt-4">:</span>
                                {/* Team B */}
                                <div className="flex-1 min-w-0 text-center">
                                  <p className="text-[10px] text-muted-foreground mb-1.5 truncate">
                                    {[game.team_b_player1_id, game.team_b_player2_id].filter(Boolean).map((id) => getName(id)).join(', ')}
                                  </p>
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => setScoreB((s) => Math.max(0, s - 1))}
                                      aria-label="B팀 점수 내리기"
                                      className="w-9 h-11 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer active:scale-95"
                                    >
                                      <Minus className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={scoreB}
                                      onChange={(e) => handleScoreInput(setScoreB, e.target.value)}
                                      onFocus={(e) => e.target.select()}
                                      aria-label="B팀 점수"
                                      className="w-12 h-11 text-center text-xl font-bold tabular-nums rounded-xl bg-muted border border-border text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setScoreB((s) => Math.min(99, s + 1))}
                                      aria-label="B팀 점수 올리기"
                                      className="w-9 h-11 rounded-lg bg-muted border border-border flex items-center justify-center hover:bg-surface-hover transition-colors cursor-pointer active:scale-95"
                                    >
                                      <Plus className="w-4 h-4 text-muted-foreground" />
                                    </button>
                                  </div>
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
                              <div className="flex-1 min-w-0 text-right">
                                <p className={cn('text-sm truncate', game.winner === 'team_a' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                                  {getName(game.team_a_player1_id)}
                                </p>
                                {game.team_a_player2_id && (
                                  <p className={cn('text-sm mt-0.5 truncate', game.winner === 'team_a' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
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
                              <div className="flex-1 min-w-0">
                                <p className={cn('text-sm truncate', game.winner === 'team_b' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                                  {getName(game.team_b_player1_id)}
                                </p>
                                {game.team_b_player2_id && (
                                  <p className={cn('text-sm mt-0.5 truncate', game.winner === 'team_b' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
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
