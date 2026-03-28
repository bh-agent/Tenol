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
import { deleteDraw, updateGamePlayers } from '@/lib/actions/games';
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
  UserX,
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

type DrawType = 'mixed_doubles' | 'mens_doubles' | 'womens_doubles' | 'free';

// ── Constants ──────────────────────────────────────────────

const DRAW_TYPE_OPTIONS: { value: DrawType; label: string; icon: string }[] = [
  { value: 'mixed_doubles', label: '혼복', icon: '\u{1F46B}' },
  { value: 'mens_doubles', label: '남복', icon: '\u{1F466}' },
  { value: 'womens_doubles', label: '여복', icon: '\u{1F467}' },
  { value: 'free', label: '자유', icon: '\u{1F3BE}' },
];

const GAME_DURATION_OPTIONS = [
  { value: '30', label: '30분' },
  { value: '40', label: '40분' },
  { value: '50', label: '50분' },
  { value: '60', label: '60분' },
];

// ── Draw type mapping (new UI values → existing API values) ──

function mapDrawTypeToApi(dt: DrawType): string {
  switch (dt) {
    case 'mixed_doubles':
      return 'mixed_gender';
    case 'mens_doubles':
      return 'ntrp_balanced';
    case 'womens_doubles':
      return 'ntrp_balanced';
    case 'free':
      return 'random';
  }
}

function mapDrawTypeFromApi(apiType: string): string {
  switch (apiType) {
    case 'mixed_gender':
      return '혼복';
    case 'ntrp_balanced':
      return 'NTRP 밸런스';
    case 'random':
      return '자유';
    default:
      return apiType;
  }
}

// ── Helper: compute time slots ─────────────────────────────

function computeTimeSlots(
  startTime: string,
  durationMinutes: number,
  maxGameOrder: number
): Record<number, { startTime: string; endTime: string }> {
  const slots: Record<number, { startTime: string; endTime: string }> = {};
  const [startH, startM] = startTime.split(':').map(Number);
  let totalMinutes = startH * 60 + startM;

  for (let order = 1; order <= maxGameOrder; order++) {
    const sH = Math.floor(totalMinutes / 60);
    const sM = totalMinutes % 60;
    const eTotal = totalMinutes + durationMinutes;
    const eH = Math.floor(eTotal / 60);
    const eM = eTotal % 60;
    slots[order] = {
      startTime: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`,
      endTime: `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`,
    };
    totalMinutes = eTotal;
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
  const [drawTypeConfig, setDrawTypeConfig] = useState<DrawType>('mixed_doubles');
  const [startTime, setStartTime] = useState('08:00');
  const [gameDuration, setGameDuration] = useState('30');
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

    // Get match info for court_count
    const { data: matchData } = await supabase
      .from('matches')
      .select('court_count')
      .eq('id', matchId)
      .single();
    if (matchData?.court_count) {
      setMatchCourtCount(matchData.court_count);
      // Init court names
      const names: Record<number, string> = {};
      for (let i = 1; i <= matchData.court_count; i++) {
        names[i] = `${i}코트`;
      }
      setCourtNames((prev) => {
        // Keep existing names if already set
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
      const apiDrawType = mapDrawTypeToApi(drawTypeConfig);
      const res = await fetch('/api/draw/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          drawType: apiDrawType,
          roundNumber: (draws.length || 0) + 1,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
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

  // ── Derived: find sit-out players per draw ──

  const getSitOutPlayers = (draw: DrawData): Participant[] => {
    const playingIds = new Set<string>();
    (draw.games || []).forEach((g) => {
      [g.team_a_player1_id, g.team_a_player2_id, g.team_b_player1_id, g.team_b_player2_id]
        .filter(Boolean)
        .forEach((id) => playingIds.add(id as string));
    });
    return participants.filter((p) => !playingIds.has(p.id));
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

        {/* ── Draw Generation Config Panel ── */}
        {canManageDraw && (
          <Card variant="glow" padding="lg">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Shuffle className="w-4 h-4 text-primary" />
              대진표 생성
            </h3>
            <div className="space-y-4">
              {/* Draw type selector - radio buttons with icons */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  대진 유형
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {DRAW_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setDrawTypeConfig(opt.value)}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2.5 px-2 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer',
                        drawTypeConfig === opt.value
                          ? 'border-primary bg-primary/10 text-primary shadow-[0_0_8px_rgba(0,230,118,0.15)]'
                          : 'border-border text-muted-foreground hover:border-foreground/30'
                      )}
                    >
                      <span className="text-lg">{opt.icon}</span>
                      <span className="text-xs">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time settings */}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="startTime"
                  label="시작 시간"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    경기 시간
                  </label>
                  <div className="grid grid-cols-2 gap-1">
                    {GAME_DURATION_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setGameDuration(opt.value)}
                        className={cn(
                          'h-11 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer',
                          gameDuration === opt.value
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:border-foreground/30'
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
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

              {/* Generate button */}
              <Button onClick={handleGenerate} disabled={generating || participants.length < 4} fullWidth>
                {generating ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Shuffle className="w-4 h-4 mr-2" />
                )}
                {generating ? '생성 중...' : `대진표 생성 (${participants.length}명)`}
              </Button>
              {participants.length < 4 && (
                <p className="text-xs text-muted-foreground text-center">복식 경기를 위해 최소 4명이 필요합니다</p>
              )}
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
            const maxOrder = sortedOrders.length > 0 ? Math.max(...sortedOrders) : 0;
            const timeSlots = computeTimeSlots(startTime, Number(gameDuration), maxOrder);
            const sitOuts = getSitOutPlayers(draw);

            return (
              <div key={draw.id} className="space-y-4">
                {/* Round header with admin actions */}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <span className="text-gradient">{draw.round_number}라운드</span>
                    <Badge variant="outline">
                      {mapDrawTypeFromApi(draw.draw_type)}
                    </Badge>
                  </h3>
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

                {/* Game rounds - grouped by game_order */}
                <div className="space-y-4">
                  {sortedOrders.map((order) => (
                    <GameRoundCard
                      key={order}
                      gameOrder={order}
                      games={gamesByOrder[order]}
                      participantMap={participantMap}
                      courtNames={courtNames}
                      timeSlot={timeSlots[order]}
                      canManage={canManageDraw}
                      canInputScore={canInputScore}
                      onEditGame={handleEditGame}
                      onScoreSaved={loadData}
                    />
                  ))}
                </div>

                {/* Sit-out players */}
                {sitOuts.length > 0 && (
                  <Card variant="glass" padding="sm">
                    <div className="flex items-center gap-2 mb-2 px-1">
                      <UserX className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-semibold text-muted-foreground">
                        이번 라운드 대기 ({sitOuts.length}명)
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 px-1">
                      {sitOuts.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-muted/50 border border-border/50"
                        >
                          <div
                            className={cn(
                              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold',
                              p.gender === 'M'
                                ? 'bg-info/20 text-info'
                                : p.gender === 'F'
                                  ? 'bg-pink-500/20 text-pink-400'
                                  : 'bg-muted text-muted-foreground'
                            )}
                          >
                            {p.name.charAt(0)}
                          </div>
                          <span className="text-sm text-muted-foreground">{p.name}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                )}

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
          이 라운드의 대진표를 삭제하시겠습니까? 모든 게임 기록이 삭제됩니다.
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
