'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { TopBar } from '@/components/layout/top-bar';
import { NTRP_LEVELS } from '@/lib/constants';
import { PlayerGameSummary } from '@/components/match/player-game-summary';
import { GameRoundCard } from '@/components/match/game-round-card';
import { addOfflineParticipant, removeParticipant } from '@/lib/actions/matches';
import { deleteDraw, updateGamePlayers, createManualDraw } from '@/lib/actions/games';
import { createClient } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/utils/permissions';
import { cn } from '@/lib/utils/cn';
import type { ClubRole } from '@/types';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Shuffle,
  Check,
  RefreshCw,
  UserPlus,
  X,
  Users,
  Trash2,
  RotateCcw,
  ChevronDown,
  PenLine,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

// ── Types ──────────────────────────────────────────────────

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

type DrawData = {
  id: string;
  round_number: number;
  draw_type: string;
  is_finalized: boolean;
  games: GameData[];
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

// New draw mode: determines how the draw engine groups players
type DrawMode = 'mixed_all' | 'mixed_only' | 'gendered_only' | 'free';

// ── Constants ──────────────────────────────────────────────

const DRAW_MODE_OPTIONS: {
  value: DrawMode;
  label: string;
  description: string;
}[] = [
  {
    value: 'mixed_all',
    label: '혼복 + 남복 + 여복',
    description: '성별에 따라 자동 배분',
  },
  {
    value: 'mixed_only',
    label: '혼복만',
    description: '혼합복식만 진행',
  },
  {
    value: 'gendered_only',
    label: '남복 + 여복',
    description: '동성끼리만 진행',
  },
  {
    value: 'free',
    label: '자유',
    description: '성별 무관 자유 배정',
  },
];

// ── Draw mode → API draw type mapping ──

function mapDrawModeToApiType(mode: DrawMode): string {
  // Send v2 mode directly to API - the API route detects v2 modes
  return mode;
}

function mapDrawTypeFromApi(apiType: string): string {
  switch (apiType) {
    case 'mixed_doubles':
      return '혼복';
    case 'mens_doubles':
      return '남복';
    case 'womens_doubles':
      return '여복';
    case 'mixed_gender':
      return '혼복';
    case 'ntrp_balanced':
      return 'NTRP 밸런스';
    case 'random':
      return '자유';
    case 'free':
      return '자유';
    case 'mixed_all':
      return '혼복+남복+여복';
    case 'mixed_only':
      return '혼복';
    case 'gendered_only':
      return '남복+여복';
    default:
      return apiType;
  }
}

// ── Helper: compute time slots ─────────────────────────────

function computeTimeSlots(
  startTime: string,
  durationMinutes: number,
  maxGameOrder: number,
  minGameOrder: number = 0
): Record<number, { startTime: string; endTime: string }> {
  const slots: Record<number, { startTime: string; endTime: string }> = {};
  const [startH, startM] = startTime.split(':').map(Number);

  for (let order = minGameOrder; order <= maxGameOrder; order++) {
    const offsetIdx = order - minGameOrder;
    const totalStart = startH * 60 + startM + offsetIdx * durationMinutes;
    const totalEnd = totalStart + durationMinutes;
    slots[order] = {
      startTime: `${String(Math.floor(totalStart / 60) % 24).padStart(2, '0')}:${String(totalStart % 60).padStart(2, '0')}`,
      endTime: `${String(Math.floor(totalEnd / 60) % 24).padStart(2, '0')}:${String(totalEnd % 60).padStart(2, '0')}`,
    };
  }
  return slots;
}

// ── Helper: group games by game_order ──────────────────────

function getGamesByOrder(games: GameData[]): Record<number, GameData[]> {
  const orders: Record<number, GameData[]> = {};
  games.forEach((g) => {
    if (!orders[g.game_order]) orders[g.game_order] = [];
    orders[g.game_order].push(g);
  });
  return orders;
}

// ── Helper: find sit-out players per time slot ─────────────

function getSitOutPlayersForSlot(
  gamesInSlot: GameData[],
  allParticipants: Participant[]
): Participant[] {
  const playingIds = new Set<string>();
  gamesInSlot.forEach((g) => {
    [g.team_a_player1_id, g.team_a_player2_id, g.team_b_player1_id, g.team_b_player2_id]
      .filter(Boolean)
      .forEach((id) => playingIds.add(id as string));
  });
  return allParticipants.filter((p) => !playingIds.has(p.id));
}

// ── Component ──────────────────────────────────────────────

export default function DrawPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const clubId = params.clubId as string;

  // Data state
  const [draws, setDraws] = useState<DrawData[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantMap, setParticipantMap] = useState<Record<string, Participant>>({});
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<ClubRole | null>(null);
  const [matchCourtCount, setMatchCourtCount] = useState(2);

  // Draw generation config
  const [drawMode, setDrawMode] = useState<DrawMode>('mixed_all');
  const [startTime, setStartTime] = useState('08:00');
  const [gameDuration, setGameDuration] = useState('30');
  const [gamesPerCourt, setGamesPerCourt] = useState(3);
  const [courtNames, setCourtNames] = useState<Record<number, string>>({});
  const [showCourtNames, setShowCourtNames] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Add participant modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addGender, setAddGender] = useState<string>('');
  const [addNtrp, setAddNtrp] = useState('');
  const [adding, setAdding] = useState(false);

  // Delete / regenerate
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  // Manual draw mode
  const [manualMode, setManualMode] = useState(false);
  const [manualGames, setManualGames] = useState<
    Record<string, { team_a_player1_id: string; team_a_player2_id: string; team_b_player1_id: string; team_b_player2_id: string }>
  >({});
  const [savingManual, setSavingManual] = useState(false);

  // Edit game modal
  const [editGame, setEditGame] = useState<GameData | null>(null);
  const [editPlayers, setEditPlayers] = useState<{
    team_a_player1_id: string;
    team_a_player2_id: string;
    team_b_player1_id: string;
    team_b_player2_id: string;
  }>({ team_a_player1_id: '', team_a_player2_id: '', team_b_player1_id: '', team_b_player2_id: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const canManageDraw = hasPermission(myRole, 'draw.manage');
  const canInputScore = hasPermission(myRole, 'result.input');

  // ── Load data ──

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

    // Get match info for court_count and start_time
    const { data: matchData } = await supabase
      .from('matches')
      .select('court_count, start_time')
      .eq('id', matchId)
      .single();
    if (matchData?.start_time) {
      // Set default start time from match's start_time (format: "HH:MM:SS" or "HH:MM")
      setStartTime(matchData.start_time.substring(0, 5));
    }
    if (matchData?.court_count) {
      setMatchCourtCount(matchData.court_count);
      // Init court names
      const names: Record<number, string> = {};
      for (let i = 1; i <= matchData.court_count; i++) {
        names[i] = `${i}코트`;
      }
      setCourtNames((prev) => {
        const merged = { ...names };
        Object.keys(prev).forEach((k) => {
          const num = Number(k);
          if (num <= matchData.court_count && prev[num]) {
            merged[num] = prev[num];
          }
        });
        return merged;
      });
    }

    const { data: drawsData } = await supabase
      .from('draws')
      .select('*, games (*)')
      .eq('match_id', matchId)
      .order('round_number');

    const { data: parts } = await supabase
      .from('match_participants')
      .select('id, user_id, guest_name, guest_gender, participant_type, status, ntrp_override, profiles:user_id (display_name, ntrp_level, gender)')
      .eq('match_id', matchId)
      .eq('status', 'confirmed');

    const pList: Participant[] = (parts || []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      guest_name: p.guest_name,
      guest_gender: p.guest_gender,
      participant_type: p.participant_type,
      status: p.status,
      ntrp_override: p.ntrp_override,
      name: p.profiles?.display_name || p.guest_name || '???',
      ntrp: p.ntrp_override || p.profiles?.ntrp_level || null,
      gender: p.profiles?.gender || p.guest_gender || null,
    }));

    const pMap: Record<string, Participant> = {};
    pList.forEach((p) => { pMap[p.id] = p; });

    setParticipants(pList);
    setParticipantMap(pMap);
    setDraws((drawsData as any) || []);
    setLoading(false);
  }, [matchId, clubId]);

  useEffect(() => { loadData(); }, [loadData]);

  const males = participants.filter((p) => p.gender === 'M');
  const females = participants.filter((p) => p.gender === 'F');
  const unknown = participants.filter((p) => !p.gender);

  // ── Handlers ──

  const handleGenerate = async () => {
    if (participants.length < 4) {
      alert('복식 경기를 위해 최소 4명의 참가자가 필요합니다');
      return;
    }
    setGenerating(true);
    try {
      const apiDrawType = mapDrawModeToApiType(drawMode);
      const courtNameArray = Array.from(
        { length: matchCourtCount },
        (_, i) => courtNames[i + 1] || `${i + 1}코트`
      );
      const res = await fetch('/api/draw/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          drawType: apiDrawType,
          roundNumber: (draws.length || 0) + 1,
          gamesPerCourt,
          timeSlotMinutes: Number(gameDuration),
          startTime,
          courtNames: courtNameArray,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        const detail = result.details ? `\n${JSON.stringify(result.details)}` : '';
        throw new Error((result.error || '대진표 생성에 실패했습니다') + detail);
      }
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '대진표 생성에 실패했습니다');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddOffline = async () => {
    if (!addName.trim()) { alert('이름을 입력해주세요'); return; }
    if (!addGender) { alert('성별을 선택해주세요'); return; }
    setAdding(true);
    try {
      await addOfflineParticipant(matchId, addName.trim(), addGender as 'M' | 'F', addNtrp ? Number(addNtrp) : undefined);
      setAddName('');
      setAddGender('');
      setAddNtrp('');
      setShowAddModal(false);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '추가에 실패했습니다');
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveParticipant = async (pid: string, name: string) => {
    if (!confirm(`${name}님을 참가자에서 제거하시겠습니까?`)) return;
    try {
      await removeParticipant(pid, matchId);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '제거에 실패했습니다');
    }
  };

  const handleDeleteDraw = async (drawId: string) => {
    setDeleting(true);
    try {
      await deleteDraw(drawId, matchId);
      setShowDeleteModal(null);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '대진표 삭제에 실패했습니다');
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerate = async (draw: DrawData) => {
    if (!confirm('대진표를 재생성하시겠습니까? 기존 게임 기록과 점수가 모두 삭제됩니다.')) return;
    setRegenerating(draw.id);
    try {
      const res = await fetch('/api/draw/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, drawType: draw.draw_type, roundNumber: draw.round_number }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '대진표 재생성에 실패했습니다');
    } finally {
      setRegenerating(null);
    }
  };

  const handleEditGame = (game: GameData) => {
    setEditGame(game);
    setEditPlayers({
      team_a_player1_id: game.team_a_player1_id || '',
      team_a_player2_id: game.team_a_player2_id || '',
      team_b_player1_id: game.team_b_player1_id || '',
      team_b_player2_id: game.team_b_player2_id || '',
    });
  };

  const handleSaveEditGame = async () => {
    if (!editGame) return;
    setSavingEdit(true);
    try {
      await updateGamePlayers(editGame.id, {
        team_a_player1_id: editPlayers.team_a_player1_id || null,
        team_a_player2_id: editPlayers.team_a_player2_id || null,
        team_b_player1_id: editPlayers.team_b_player1_id || null,
        team_b_player2_id: editPlayers.team_b_player2_id || null,
      });
      setEditGame(null);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '선수 배정 수정에 실패했습니다');
    } finally {
      setSavingEdit(false);
    }
  };

  // ── Manual draw mode ──

  const initManualMode = () => {
    const initial: Record<string, { team_a_player1_id: string; team_a_player2_id: string; team_b_player1_id: string; team_b_player2_id: string }> = {};
    for (let slot = 1; slot <= gamesPerCourt; slot++) {
      for (let court = 1; court <= matchCourtCount; court++) {
        const key = `${slot}-${court}`;
        initial[key] = { team_a_player1_id: '', team_a_player2_id: '', team_b_player1_id: '', team_b_player2_id: '' };
      }
    }
    setManualGames(initial);
    setManualMode(true);
  };

  const handleSaveManualDraw = async () => {
    // Build game inserts from manual grid
    const gameInserts: {
      court_number: number;
      game_order: number;
      team_a_player1_id: string | null;
      team_a_player2_id: string | null;
      team_b_player1_id: string | null;
      team_b_player2_id: string | null;
    }[] = [];

    for (let slot = 1; slot <= gamesPerCourt; slot++) {
      for (let court = 1; court <= matchCourtCount; court++) {
        const key = `${slot}-${court}`;
        const g = manualGames[key];
        if (!g) continue;
        // Skip empty games (no players assigned)
        const hasPlayers = g.team_a_player1_id || g.team_a_player2_id || g.team_b_player1_id || g.team_b_player2_id;
        if (!hasPlayers) continue;
        gameInserts.push({
          court_number: court - 1, // 0-indexed like V2 engine
          game_order: slot - 1, // 0-indexed like V2 engine
          team_a_player1_id: g.team_a_player1_id || null,
          team_a_player2_id: g.team_a_player2_id || null,
          team_b_player1_id: g.team_b_player1_id || null,
          team_b_player2_id: g.team_b_player2_id || null,
        });
      }
    }

    if (gameInserts.length === 0) {
      alert('최소 1개의 경기에 선수를 배정해주세요');
      return;
    }

    setSavingManual(true);
    try {
      await createManualDraw(matchId, 'free', gameInserts);
      setManualMode(false);
      await loadData();
    } catch (e) {
      alert(e instanceof Error ? e.message : '대진표 저장에 실패했습니다');
    } finally {
      setSavingManual(false);
    }
  };

  // ── Participant chip renderer ──

  const renderParticipantChip = (p: Participant) => (
    <div
      key={p.id}
      className={cn(
        'flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5 border transition-colors',
        p.gender === 'M'
          ? 'bg-info/10 border-info/20 text-info'
          : p.gender === 'F'
            ? 'bg-pink-500/10 border-pink-500/20 text-pink-400'
            : 'bg-surface-elevated border-border text-muted-foreground'
      )}
    >
      <span className="text-sm font-medium text-foreground">{p.name}</span>
      {p.ntrp && (
        <span className="text-[10px] text-primary font-semibold">{p.ntrp}</span>
      )}
      {!p.user_id && (
        <span className="text-[10px] text-muted-foreground">(비회원)</span>
      )}
      {canManageDraw && (
        <button
          onClick={() => handleRemoveParticipant(p.id, p.name)}
          className="p-0.5 rounded-full hover:bg-destructive/20 transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
        </button>
      )}
    </div>
  );

  // Player select options for edit modal
  const playerOptions = participants.map((p) => ({
    value: p.id,
    label: `${p.name}${p.gender === 'M' ? ' (남)' : p.gender === 'F' ? ' (여)' : ''}`,
  }));

  return (
    <>
      <TopBar title="대진표" backHref={`/clubs/${clubId}/matches/${matchId}`} />

      <div className="px-4 py-4 space-y-4 animate-fade-in">
        {/* ── Participants ── */}
        <Card variant="glass" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              참가자 ({participants.length}명)
            </h3>
            {canManageDraw && (
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-1.5 text-sm text-primary font-medium px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                추가
              </button>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-6">
              <RefreshCw className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : participants.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">확정된 참가자가 없습니다</p>
          ) : (
            <div className="space-y-4">
              {males.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-info mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-info" />
                    남 <span className="text-muted-foreground font-normal">{males.length}명</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {males.map(renderParticipantChip)}
                  </div>
                </div>
              )}
              {females.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-pink-400 mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-pink-400" />
                    녀 <span className="text-muted-foreground font-normal">{females.length}명</span>
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {females.map(renderParticipantChip)}
                  </div>
                </div>
              )}
              {unknown.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-2">미지정 {unknown.length}명</p>
                  <div className="flex flex-wrap gap-1.5">
                    {unknown.map(renderParticipantChip)}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── Draw Config Panel ── */}
        {canManageDraw && (
          <Card variant="glow" padding="lg">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Shuffle className="w-4 h-4 text-primary" />
              대진표 생성
            </h3>
            <div className="space-y-4">
              {/* Mode selector - 4 radio cards */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  대진 모드
                </label>
                <div className="grid grid-cols-1 gap-2">
                  {DRAW_MODE_OPTIONS.map((opt) => {
                    const isSelected = drawMode === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDrawMode(opt.value)}
                        className={cn(
                          'flex items-start gap-3 p-3 rounded-xl border text-left transition-all duration-200 cursor-pointer',
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-[0_0_8px_rgba(0,230,118,0.15)]'
                            : 'border-border hover:border-foreground/30'
                        )}
                      >
                        <div
                          className={cn(
                            'mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                            isSelected
                              ? 'border-primary'
                              : 'border-muted-foreground/40'
                          )}
                        >
                          {isSelected && (
                            <div className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div
                            className={cn(
                              'text-sm font-semibold',
                              isSelected ? 'text-primary' : 'text-foreground'
                            )}
                          >
                            {opt.label}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {opt.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Settings grid */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    코트 수
                  </label>
                  <div className="h-11 rounded-xl border border-border bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                    {matchCourtCount}코트
                  </div>
                </div>
                <Input
                  id="gamesPerCourt"
                  label="코트 당 경기 수"
                  type="number"
                  value={String(gamesPerCourt)}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    if (!isNaN(v) && v >= 1 && v <= 50) setGamesPerCourt(v);
                  }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="startTime"
                  label="시작 시간"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <Input
                  id="gameDuration"
                  label="경기 시간 (분)"
                  type="number"
                  min={10}
                  max={120}
                  value={gameDuration}
                  onChange={(e) => setGameDuration(e.target.value)}
                />
              </div>

              {/* Court names - expandable */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowCourtNames(!showCourtNames)}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 transition-transform duration-200',
                      showCourtNames && 'rotate-180'
                    )}
                  />
                  코트 이름 설정
                </button>
                {showCourtNames && (
                  <div className="mt-2 space-y-2 animate-fade-in">
                    {Array.from({ length: matchCourtCount }, (_, i) => i + 1).map((num) => (
                      <Input
                        key={num}
                        id={`court-${num}`}
                        label={`${num}번 코트`}
                        placeholder={`${num}코트`}
                        value={courtNames[num] || ''}
                        onChange={(e) =>
                          setCourtNames((prev) => ({ ...prev, [num]: e.target.value }))
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Generate buttons */}
              <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleGenerate} disabled={generating || participants.length < 4} fullWidth>
                  {generating ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Shuffle className="w-4 h-4 mr-2" />
                  )}
                  {generating ? '생성 중...' : '자동 생성'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={initManualMode}
                  disabled={participants.length < 2}
                  fullWidth
                >
                  <PenLine className="w-4 h-4 mr-2" />
                  수동으로 만들기
                </Button>
              </div>
              {participants.length < 4 && (
                <p className="text-xs text-muted-foreground text-center">복식 경기를 위해 최소 4명이 필요합니다</p>
              )}
            </div>
          </Card>
        )}

        {/* ── Manual Draw Editor ── */}
        {manualMode && canManageDraw && (
          <Card variant="glass" padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <PenLine className="w-4 h-4 text-primary" />
                수동 대진표
              </h3>
              <button
                onClick={() => setManualMode(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              {matchCourtCount}코트 · {gamesPerCourt}타임 · 각 경기에 선수를 직접 배정하세요
            </p>
            <div className="space-y-5">
              {Array.from({ length: gamesPerCourt }, (_, slotIdx) => {
                const slotNum = slotIdx + 1;
                const slotStart = (() => {
                  const [h, m] = startTime.split(':').map(Number);
                  const total = h * 60 + m + slotIdx * Number(gameDuration);
                  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
                })();
                const slotEnd = (() => {
                  const [h, m] = startTime.split(':').map(Number);
                  const total = h * 60 + m + (slotIdx + 1) * Number(gameDuration);
                  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
                })();

                return (
                  <div key={slotNum} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-semibold text-foreground">{slotNum}경기</span>
                      <span className="text-xs text-muted-foreground">{slotStart} ~ {slotEnd}</span>
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${matchCourtCount}, 1fr)` }}>
                      {Array.from({ length: matchCourtCount }, (_, courtIdx) => {
                        const courtNum = courtIdx + 1;
                        const key = `${slotNum}-${courtNum}`;
                        const g = manualGames[key] || { team_a_player1_id: '', team_a_player2_id: '', team_b_player1_id: '', team_b_player2_id: '' };

                        return (
                          <div key={key} className="rounded-xl border border-border bg-surface-elevated p-3 space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground">{courtNames[courtNum] || `${courtNum}코트`}</p>
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-semibold text-primary">팀 A</p>
                              <Select
                                id={`m-${key}-a1`}
                                options={playerOptions}
                                value={g.team_a_player1_id}
                                onChange={(e) => setManualGames(prev => ({ ...prev, [key]: { ...prev[key], team_a_player1_id: e.target.value } }))}
                                placeholder="선수 1"
                              />
                              <Select
                                id={`m-${key}-a2`}
                                options={[{ value: '', label: '-' }, ...playerOptions]}
                                value={g.team_a_player2_id}
                                onChange={(e) => setManualGames(prev => ({ ...prev, [key]: { ...prev[key], team_a_player2_id: e.target.value } }))}
                                placeholder="선수 2"
                              />
                            </div>
                            <div className="text-center text-[10px] text-muted-foreground font-bold">VS</div>
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-semibold text-foreground">팀 B</p>
                              <Select
                                id={`m-${key}-b1`}
                                options={playerOptions}
                                value={g.team_b_player1_id}
                                onChange={(e) => setManualGames(prev => ({ ...prev, [key]: { ...prev[key], team_b_player1_id: e.target.value } }))}
                                placeholder="선수 1"
                              />
                              <Select
                                id={`m-${key}-b2`}
                                options={[{ value: '', label: '-' }, ...playerOptions]}
                                value={g.team_b_player2_id}
                                onChange={(e) => setManualGames(prev => ({ ...prev, [key]: { ...prev[key], team_b_player2_id: e.target.value } }))}
                                placeholder="선수 2"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3 mt-5">
              <Button
                variant="secondary"
                onClick={() => setManualMode(false)}
                fullWidth
              >
                취소
              </Button>
              <Button
                onClick={handleSaveManualDraw}
                disabled={savingManual}
                loading={savingManual}
                fullWidth
              >
                {savingManual ? '저장 중...' : '대진표 저장'}
              </Button>
            </div>
          </Card>
        )}

        {/* ── Draw Results ── */}
        {!loading && draws.length === 0 ? (
          <EmptyState
            icon={Shuffle}
            title="아직 대진표가 없어요"
            description={canManageDraw
              ? '참가자를 확인하고 대진표를 생성해보세요'
              : '운영진이 대진표를 생성할 때까지 기다려주세요'
            }
          />
        ) : (
          draws.map((draw) => {
            const gamesByOrder = getGamesByOrder(draw.games || []);
            const sortedOrders = Object.keys(gamesByOrder)
              .map(Number)
              .sort((a, b) => a - b);
            const minOrder = sortedOrders.length > 0 ? Math.min(...sortedOrders) : 0;
            const maxOrder = sortedOrders.length > 0 ? Math.max(...sortedOrders) : 0;
            const timeSlots = computeTimeSlots(startTime, Number(gameDuration), maxOrder, minOrder);

            return (
              <div key={draw.id} className="space-y-4">
                {/* Draw header with admin actions */}
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-sm text-muted-foreground">
                      {mapDrawTypeFromApi(draw.draw_type)} · {matchCourtCount}코트 · {(draw.games || []).length}경기 · {(() => {
                        const firstSlot = timeSlots[sortedOrders[0]];
                        const lastSlot = timeSlots[sortedOrders[sortedOrders.length - 1]];
                        return `${firstSlot?.startTime || '--:--'}~${lastSlot?.endTime || '--:--'}`;
                      })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {canManageDraw && (
                      <>
                        <button
                          onClick={() => handleRegenerate(draw)}
                          disabled={regenerating === draw.id}
                          className="flex items-center gap-1 text-xs text-primary font-medium px-2.5 py-1.5 rounded-lg hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-40"
                        >
                          {regenerating === draw.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3.5 h-3.5" />
                          )}
                          재생성
                        </button>
                        <button
                          onClick={() => setShowDeleteModal(draw.id)}
                          className="flex items-center gap-1 text-xs text-destructive font-medium px-2.5 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          삭제
                        </button>
                      </>
                    )}
                    {draw.is_finalized && (
                      <Badge variant="success">
                        <Check className="w-3 h-3 mr-1" />확정
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Time-slot based game display */}
                <div className="space-y-4">
                  {sortedOrders.map((order) => {
                    const slotGames = gamesByOrder[order];
                    const slot = timeSlots[order];
                    const sitOuts = getSitOutPlayersForSlot(slotGames, participants);
                    const sitOutNames = sitOuts.map((p) => p.name);

                    return (
                      <GameRoundCard
                        key={order}
                        timeSlotIndex={order}
                        startTime={slot?.startTime || '--:--'}
                        endTime={slot?.endTime || '--:--'}
                        games={slotGames}
                        participantMap={participantMap}
                        courtNames={courtNames}
                        canManage={canManageDraw}
                        canInputScore={canInputScore}
                        sitOutNames={sitOutNames.length > 0 ? sitOutNames : undefined}
                        onEditGame={handleEditGame}
                        onScoreSaved={loadData}
                      />
                    );
                  })}
                </div>

                {/* Player Game Summary */}
                {(draw.games || []).length > 0 && (
                  <PlayerGameSummary
                    games={draw.games || []}
                    participantMap={participantMap}
                    courtNames={courtNames}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* ── Delete draw confirmation modal ── */}
      <Modal isOpen={!!showDeleteModal} onClose={() => setShowDeleteModal(null)} title="대진표 삭제">
        <p className="text-sm text-muted-foreground mb-5">
          이 대진표를 삭제하시겠습니까? 모든 게임 기록이 삭제됩니다.
        </p>
        <div className="flex gap-3">
          <Button
            variant="secondary"
            onClick={() => setShowDeleteModal(null)}
            fullWidth
          >
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={() => showDeleteModal && handleDeleteDraw(showDeleteModal)}
            disabled={deleting}
            loading={deleting}
            fullWidth
          >
            {deleting ? '삭제 중...' : '삭제하기'}
          </Button>
        </div>
      </Modal>

      {/* ── Add offline participant modal ── */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="참가자 추가">
        <p className="text-sm text-muted-foreground mb-5">
          앱에 가입하지 않은 참가자를 직접 추가할 수 있습니다.
        </p>
        <div className="space-y-4">
          <Input
            id="add_name"
            label="이름"
            placeholder="참가자 이름"
            value={addName}
            onChange={(e) => setAddName(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              성별 <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAddGender('M')}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer',
                  addGender === 'M'
                    ? 'border-info bg-info/15 text-info glow-primary-sm'
                    : 'border-border text-muted-foreground hover:border-foreground/30'
                )}
              >
                남성
              </button>
              <button
                type="button"
                onClick={() => setAddGender('F')}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer',
                  addGender === 'F'
                    ? 'border-pink-500 bg-pink-500/15 text-pink-400'
                    : 'border-border text-muted-foreground hover:border-foreground/30'
                )}
              >
                여성
              </button>
            </div>
          </div>
          <Select
            id="add_ntrp"
            label="NTRP (선택)"
            options={NTRP_LEVELS.map((l) => ({ ...l }))}
            value={addNtrp}
            onChange={(e) => setAddNtrp(e.target.value)}
            placeholder="모르면 비워두세요"
          />
          <Button onClick={handleAddOffline} disabled={adding} fullWidth>
            {adding ? '추가 중...' : '추가하기'}
          </Button>
        </div>
      </Modal>

      {/* ── Edit game modal ── */}
      <Modal isOpen={!!editGame} onClose={() => setEditGame(null)} title="경기 수정">
        {editGame && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              선수 배정을 수정합니다.
            </p>

            <div className="space-y-3">
              <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
                <p className="text-xs font-semibold text-primary mb-2">팀 A</p>
                <div className="space-y-2">
                  <Select
                    id="edit_a1"
                    label="선수 1"
                    options={playerOptions}
                    value={editPlayers.team_a_player1_id}
                    onChange={(e) => setEditPlayers((prev) => ({ ...prev, team_a_player1_id: e.target.value }))}
                    placeholder="선수 선택"
                  />
                  <Select
                    id="edit_a2"
                    label="선수 2"
                    options={[{ value: '', label: '없음' }, ...playerOptions]}
                    value={editPlayers.team_a_player2_id}
                    onChange={(e) => setEditPlayers((prev) => ({ ...prev, team_a_player2_id: e.target.value }))}
                    placeholder="선수 선택"
                  />
                </div>
              </div>

              <div className="bg-surface-elevated rounded-lg p-3 border border-border">
                <p className="text-xs font-semibold text-foreground mb-2">팀 B</p>
                <div className="space-y-2">
                  <Select
                    id="edit_b1"
                    label="선수 1"
                    options={playerOptions}
                    value={editPlayers.team_b_player1_id}
                    onChange={(e) => setEditPlayers((prev) => ({ ...prev, team_b_player1_id: e.target.value }))}
                    placeholder="선수 선택"
                  />
                  <Select
                    id="edit_b2"
                    label="선수 2"
                    options={[{ value: '', label: '없음' }, ...playerOptions]}
                    value={editPlayers.team_b_player2_id}
                    onChange={(e) => setEditPlayers((prev) => ({ ...prev, team_b_player2_id: e.target.value }))}
                    placeholder="선수 선택"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                onClick={() => setEditGame(null)}
                fullWidth
              >
                취소
              </Button>
              <Button
                onClick={handleSaveEditGame}
                disabled={savingEdit}
                loading={savingEdit}
                fullWidth
              >
                {savingEdit ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
