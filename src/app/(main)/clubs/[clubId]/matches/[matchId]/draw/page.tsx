'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import { TopBar } from '@/components/layout/top-bar';
import { NTRP_LEVELS } from '@/lib/constants';
import { PlayerGameSummary } from '@/components/match/player-game-summary';
import { GameRoundCard } from '@/components/match/game-round-card';
import { addOfflineParticipant, addMemberParticipant, removeParticipant, replaceParticipant, replaceWithOffline } from '@/lib/actions/matches';
import { deleteDraw, updateGamePlayers, createManualDraw, addGame, deleteGame } from '@/lib/actions/games';
import { acquireDrawLock, releaseDrawLock, checkDrawLock, type DrawLockResult } from '@/lib/actions/draw-lock';
import { createClient } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/utils/permissions';
import { cn } from '@/lib/utils/cn';
import type { ClubRole } from '@/types';
import { EmptyState } from '@/components/ui/empty-state';
import { SubstitutePlayerModal } from '@/components/match/substitute-player-modal';
import { DrawShareImage, type DrawShareImageProps } from '@/components/match/draw-share-image';
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
  ArrowRightLeft,
  Replace,
  Share2,
  Download,
  Loader2,
  Lock,
  Search,
  Plus,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

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
  drawName: string;
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
    description: '혼복만 진행',
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
  const toast = useToast();

  // Confirm modal state
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // Data state
  const [draws, setDraws] = useState<DrawData[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantMap, setParticipantMap] = useState<Record<string, Participant>>({});
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<ClubRole | null>(null);
  const [matchCourtCount, setMatchCourtCount] = useState(2);
  const [matchStatus, setMatchStatus] = useState<string>('upcoming');
  const [matchTitle, setMatchTitle] = useState('');
  const [matchDate, setMatchDate] = useState('');

  // Image export
  const [exportingImage, setExportingImage] = useState(false);
  const [exportingDrawId, setExportingDrawId] = useState<string | null>(null);

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
  const [addTab, setAddTab] = useState<'member' | 'offline'>('member');
  const [addName, setAddName] = useState('');
  const [addGender, setAddGender] = useState<string>('');
  const [addNtrp, setAddNtrp] = useState('');
  const [adding, setAdding] = useState(false);
  const [clubMembers, setClubMembers] = useState<{ userId: string; name: string; gender: 'M' | 'F' | null; ntrp: number | null }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

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

  // Gender overrides (draw engine only - doesn't change profile)
  const [genderOverrides, setGenderOverrides] = useState<Record<string, 'M' | 'F'>>({});

  // Substitute player
  const [substituteTarget, setSubstituteTarget] = useState<Participant | null>(null);
  const [substituting, setSubstituting] = useState(false);

  // Draw edit lock
  const [drawLocked, setDrawLocked] = useState(false);
  const [lockHolder, setLockHolder] = useState<string>('');
  const [lockStartTime, setLockStartTime] = useState<string>('');
  const drawLockedRef = useRef(false);

  // Edit game modal
  const [editGame, setEditGame] = useState<GameData | null>(null);
  const [editPlayers, setEditPlayers] = useState<{
    team_a_player1_id: string;
    team_a_player2_id: string;
    team_b_player1_id: string;
    team_b_player2_id: string;
  }>({ team_a_player1_id: '', team_a_player2_id: '', team_b_player1_id: '', team_b_player2_id: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const isMatchEnded = matchStatus === 'completed' || matchStatus === 'cancelled';
  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin';
  // 전체 관리(생성·재생성·삭제·수동편집)는 종료 전에만.
  const canManageDraw = hasPermission(myRole, 'draw.manage') && !isMatchEnded;
  // 개별 게임 수정·선수 교체: 종료된 대진은 회장·운영진만 (점수 보존, 재생성·삭제는 불가).
  const canEditGames = canManageDraw || (isMatchEnded && isOwnerOrAdmin);
  const canInputScore = hasPermission(myRole, 'result.input');

  // Whether editing is blocked by another user's lock
  const isEditBlocked = drawLocked && canManageDraw;

  // ── Draw edit lock ──

  const applyLockResult = useCallback((result: DrawLockResult) => {
    if (result.locked) {
      setDrawLocked(true);
      drawLockedRef.current = true;
      setLockHolder(result.lockedBy);
      setLockStartTime(result.lockedAt);
    } else {
      setDrawLocked(false);
      drawLockedRef.current = false;
      setLockHolder('');
      setLockStartTime('');
    }
  }, []);

  // Acquire lock on mount (for admins), release on unmount
  useEffect(() => {
    if (!canManageDraw) return;

    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const init = async () => {
      try {
        const result = await acquireDrawLock(matchId);
        applyLockResult(result);

        // Poll every 30s: refresh own lock or check if still locked
        pollInterval = setInterval(async () => {
          try {
            if (drawLockedRef.current) {
              // We're blocked - just check status
              const status = await checkDrawLock(matchId);
              applyLockResult(status);
              // If lock expired, try to acquire
              if (!status.locked) {
                const acq = await acquireDrawLock(matchId);
                applyLockResult(acq);
              }
            } else {
              // We hold the lock - refresh it
              const result = await acquireDrawLock(matchId);
              applyLockResult(result);
            }
          } catch {
            // Polling failure is non-fatal
          }
        }, 30000);
      } catch {
        // Lock acquisition failure is non-fatal
      }
    };

    init();

    // Release on unmount
    return () => {
      if (pollInterval) clearInterval(pollInterval);
      // Fire-and-forget release
      releaseDrawLock(matchId).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, canManageDraw]);

  // Release lock on page close/navigation (beacon fallback)
  useEffect(() => {
    if (!canManageDraw) return;

    const handleBeforeUnload = () => {
      // Use fetch with keepalive for reliable delivery on page close
      const url = `${window.location.origin}/api/draw/release-lock`;
      try {
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ matchId }),
          keepalive: true,
        });
      } catch {
        // Best-effort
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [matchId, canManageDraw]);

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
        .maybeSingle();
      setMyRole((membership?.role as ClubRole) || null);
    }

    // Get match info for court_count, start_time, title, date
    const { data: matchData } = await supabase
      .from('matches')
      .select('court_count, start_time, title, match_date, status')
      .eq('id', matchId)
      .maybeSingle();
    if (matchData?.start_time) {
      // Set default start time from match's start_time (format: "HH:MM:SS" or "HH:MM")
      setStartTime(matchData.start_time.substring(0, 5));
    }
    if (matchData?.title) setMatchTitle(matchData.title);
    if (matchData?.match_date) setMatchDate(matchData.match_date);
    if (matchData?.status) setMatchStatus(matchData.status);
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
      .select('id, user_id, guest_name, guest_gender, participant_type, status, ntrp_override, profiles:user_id (display_name, real_name, ntrp_level, gender)')
      .eq('match_id', matchId)
      .eq('status', 'confirmed');

    const pList: Participant[] = (parts || []).map((p: any) => {
      const displayName = p.profiles?.display_name || p.guest_name || '???';
      const realName = p.profiles?.real_name;
      // Draw display: "실명(닉네임)" if real_name exists, otherwise just display_name
      const drawName = realName ? `${realName}(${displayName})` : displayName;
      return {
        id: p.id,
        user_id: p.user_id,
        guest_name: p.guest_name,
        guest_gender: p.guest_gender,
        participant_type: p.participant_type,
        status: p.status,
        ntrp_override: p.ntrp_override,
        name: displayName,
        drawName,
        ntrp: p.ntrp_override || p.profiles?.ntrp_level || null,
        gender: p.profiles?.gender || p.guest_gender || null,
      };
    });

    const pMap: Record<string, Participant> = {};
    pList.forEach((p) => { pMap[p.id] = p; });

    setParticipants(pList);
    setParticipantMap(pMap);
    setDraws((drawsData as any) || []);

    // 기존 대진표가 있으면 경기 수(=최대 game_order)를 복원한다.
    // (games_per_court가 DB에 저장되지 않아, 재생성 시 기본값 3으로 축소되던 문제 완화)
    const existingGames = (drawsData as any)?.[0]?.games as { game_order: number }[] | undefined;
    if (existingGames && existingGames.length > 0) {
      const maxOrder = Math.max(...existingGames.map((g) => g.game_order || 1));
      if (maxOrder > 0) setGamesPerCourt(maxOrder);
    }

    setLoading(false);
  }, [matchId, clubId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Effective gender considers overrides
  const getEffectiveGender = (p: Participant) => genderOverrides[p.id] || p.gender;
  const males = participants.filter((p) => getEffectiveGender(p) === 'M');
  const females = participants.filter((p) => getEffectiveGender(p) === 'F');
  const unknown = participants.filter((p) => !getEffectiveGender(p));

  // ── Handlers ──

  const handleGenerate = async () => {
    if (participants.length < 4) {
      toast.warning('복식 경기를 위해 최소 4명의 참가자가 필요합니다');
      return;
    }
    // 이미 대진표가 있으면 재생성과 동일하게 파괴적 동작임을 경고 (기존 점수 삭제)
    if (draws.length > 0) {
      setConfirmAction({
        message: '이미 대진표가 있습니다. 새로 생성하면 기존 대진표와 입력된 점수가 모두 삭제됩니다. 계속하시겠습니까?',
        onConfirm: () => { void doGenerate(); },
      });
      return;
    }
    await doGenerate();
  };

  const doGenerate = async () => {
    setGenerating(true);
    try {
      const apiDrawType = mapDrawModeToApiType(drawMode);
      const courtNameArray = Array.from(
        { length: matchCourtCount },
        (_, i) => courtNames[i + 1] || `${i + 1}코트`
      );
      // Pass gender overrides so the API can apply them before draw generation
      const overrides = Object.keys(genderOverrides).length > 0 ? genderOverrides : undefined;
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
          genderOverrides: overrides,
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        const detail = result.details ? `\n${JSON.stringify(result.details)}` : '';
        throw new Error((result.error || '대진표 생성에 실패했습니다') + detail);
      }
      await loadData();
      toast.success('대진표가 생성되었습니다');
      // 생성된 대진표로 자동 스크롤 (DOM 렌더링 이후 실행)
      setTimeout(() => {
        document.getElementById('draw-results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '대진표 생성에 실패했습니다');
    } finally {
      setGenerating(false);
    }
  };

  const handleAddOffline = async () => {
    if (!addName.trim()) { toast.warning('이름을 입력해주세요'); return; }
    if (!addGender) { toast.warning('성별을 선택해주세요'); return; }
    setAdding(true);
    try {
      await addOfflineParticipant(matchId, addName.trim(), addGender as 'M' | 'F', addNtrp ? Number(addNtrp) : undefined);
      setAddName('');
      setAddGender('');
      setAddNtrp('');
      setShowAddModal(false);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '추가에 실패했습니다');
    } finally {
      setAdding(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setAdding(true);
    try {
      await addMemberParticipant(matchId, userId);
      setShowAddModal(false);
      setMemberSearch('');
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '추가에 실패했습니다');
    } finally {
      setAdding(false);
    }
  };

  // Load club members when add modal opens on member tab
  useEffect(() => {
    if (!showAddModal || addTab !== 'member') return;
    const load = async () => {
      setLoadingMembers(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('club_members')
        .select('user_id, profiles:user_id (display_name, gender, ntrp_level)')
        .eq('club_id', clubId);
      if (data) {
        const existingUserIds = new Set(participants.filter(p => p.user_id).map(p => p.user_id!));
        const mapped = data
          .map((m: any) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return {
              userId: m.user_id,
              name: profile?.display_name || '???',
              gender: (profile?.gender as 'M' | 'F') || null,
              ntrp: profile?.ntrp_level || null,
            };
          })
          .filter(m => !existingUserIds.has(m.userId));
        setClubMembers(mapped);
      }
      setLoadingMembers(false);
    };
    load();
  }, [showAddModal, addTab, clubId, participants]);

  const handleRemoveParticipant = async (pid: string, name: string) => {
    setConfirmAction({
      message: `${name}님을 참가자에서 제거하시겠습니까?`,
      onConfirm: async () => {
        const result = await removeParticipant(pid, matchId);
        if (result?.error) {
          toast.error(result.error);
        } else {
          await loadData();
        }
      },
    });
  };

  const handleDeleteDraw = async (drawId: string) => {
    setDeleting(true);
    try {
      const res = await deleteDraw(drawId, matchId);
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setShowDeleteModal(null);
      await loadData();
    } finally {
      setDeleting(false);
    }
  };

  const handleRegenerate = async (draw: DrawData) => {
    setConfirmAction({
      message: '대진표를 재생성하시겠습니까? 기존 게임 기록과 점수가 모두 삭제됩니다.',
      onConfirm: async () => {
        setRegenerating(draw.id);
        try {
          const courtNameArray = Array.from(
            { length: matchCourtCount },
            (_, i) => courtNames[i + 1] || `${i + 1}코트`
          );
          const overrides = Object.keys(genderOverrides).length > 0 ? genderOverrides : undefined;
          const res = await fetch('/api/draw/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              matchId,
              drawType: draw.draw_type,
              roundNumber: draw.round_number,
              gamesPerCourt,
              timeSlotMinutes: Number(gameDuration),
              startTime,
              courtNames: courtNameArray,
              genderOverrides: overrides,
            }),
          });
          const result = await res.json();
          if (!res.ok) throw new Error(result.error);
          await loadData();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '대진표 재생성에 실패했습니다');
        } finally {
          setRegenerating(null);
        }
      },
    });
  };

  // ── Gender override toggle ──

  const toggleGenderOverride = (p: Participant) => {
    const currentGender = getEffectiveGender(p);
    const newGender = currentGender === 'M' ? 'F' : 'M';
    setGenderOverrides(prev => ({ ...prev, [p.id]: newGender }));
  };

  // ── Substitute player handlers ──

  const handleSubstituteMember = async (member: { userId: string }) => {
    if (!substituteTarget) return;
    setSubstituting(true);
    const result = await replaceParticipant(matchId, substituteTarget.id, member.userId);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setSubstituteTarget(null);
      await loadData();
    }
    setSubstituting(false);
  };

  const handleSubstituteOffline = async (name: string, gender: 'M' | 'F', ntrp?: number) => {
    if (!substituteTarget) return;
    setSubstituting(true);
    const result = await replaceWithOffline(matchId, substituteTarget.id, name, gender, ntrp);
    if (result?.error) {
      toast.error(result.error);
    } else {
      setSubstituteTarget(null);
      await loadData();
    }
    setSubstituting(false);
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

  // 대진표에 경기 추가 → 빈 경기 생성 후 선수 배정 모달을 바로 연다
  const handleAddGame = async (drawId: string, gameOrder: number) => {
    const res = await addGame(matchId, drawId, gameOrder);
    if ('error' in res) {
      toast.error(res.error);
      return;
    }
    await loadData();
    handleEditGame({
      id: res.gameId,
      court_number: res.courtNumber,
      game_order: res.gameOrder,
      team_a_player1_id: null,
      team_a_player2_id: null,
      team_b_player1_id: null,
      team_b_player2_id: null,
      score_team_a: null,
      score_team_b: null,
      winner: null,
      status: 'scheduled',
    });
  };

  // 개별 경기 삭제 (점수가 있으면 경고)
  const handleDeleteGame = (game: GameData) => {
    const hasScore = game.score_team_a !== null || game.score_team_b !== null;
    setConfirmAction({
      message: hasScore
        ? '이 경기에는 입력된 점수가 있습니다. 삭제하면 점수 기록도 함께 사라집니다. 삭제하시겠습니까?'
        : '이 경기를 삭제하시겠습니까?',
      onConfirm: async () => {
        const res = await deleteGame(game.id);
        if (res?.error) {
          toast.error(res.error);
          return;
        }
        await loadData();
      },
    });
  };

  const handleSaveEditGame = async () => {
    if (!editGame) return;
    setSavingEdit(true);
    try {
      const res = await updateGamePlayers(editGame.id, {
        team_a_player1_id: editPlayers.team_a_player1_id || null,
        team_a_player2_id: editPlayers.team_a_player2_id || null,
        team_b_player1_id: editPlayers.team_b_player1_id || null,
        team_b_player2_id: editPlayers.team_b_player2_id || null,
      });
      if (res?.error) {
        toast.error(res.error);
        return;
      }
      setEditGame(null);
      await loadData();
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
          court_number: court, // 1-based (matches auto-generate + renderers)
          game_order: slot, // 1-based (matches auto-generate + renderers)
          team_a_player1_id: g.team_a_player1_id || null,
          team_a_player2_id: g.team_a_player2_id || null,
          team_b_player1_id: g.team_b_player1_id || null,
          team_b_player2_id: g.team_b_player2_id || null,
        });
      }
    }

    if (gameInserts.length === 0) {
      toast.warning('최소 1개의 경기에 선수를 배정해주세요');
      return;
    }

    setSavingManual(true);
    try {
      const res = await createManualDraw(matchId, 'free', gameInserts);
      if (res && 'error' in res) {
        toast.error(res.error);
        return;
      }
      setManualMode(false);
      await loadData();
    } finally {
      setSavingManual(false);
    }
  };

  // ── Image export ──

  const getDrawImageProps = (draw: DrawData): DrawShareImageProps | null => {
    const gamesByOrder = getGamesByOrder(draw.games || []);
    const sortedOrders = Object.keys(gamesByOrder)
      .map(Number)
      .sort((a, b) => a - b);
    if (sortedOrders.length === 0) return null;
    const minOrder = Math.min(...sortedOrders);
    const maxOrder = Math.max(...sortedOrders);
    const timeSlots = computeTimeSlots(startTime, Number(gameDuration), maxOrder, minOrder);

    const sitOutsBySlot: Record<number, string[]> = {};
    sortedOrders.forEach((order) => {
      const sitOuts = getSitOutPlayersForSlot(gamesByOrder[order], participants);
      if (sitOuts.length > 0) {
        sitOutsBySlot[order] = sitOuts.map((p) => p.drawName);
      }
    });

    return {
      matchTitle: matchTitle || '대진표',
      matchDate: matchDate || new Date().toISOString().split('T')[0],
      startTime,
      courtCount: matchCourtCount,
      drawType: mapDrawTypeFromApi(draw.draw_type),
      gamesByOrder,
      sortedOrders,
      timeSlots,
      participantMap,
      courtNames,
      sitOutsBySlot,
    };
  };

  const generateDrawImage = async (draw: DrawData): Promise<Blob | null> => {
    const html2canvasModule = await import('html2canvas').catch(() => null);
    if (!html2canvasModule) {
      toast.error('이미지 생성 라이브러리를 로드할 수 없습니다.');
      return null;
    }
    const html2canvas = html2canvasModule.default;

    const props = getDrawImageProps(draw);
    if (!props) {
      toast.error('대진표 데이터를 가져올 수 없습니다.');
      return null;
    }

    // Create a temporary VISIBLE container (html2canvas needs it in layout)
    const tempContainer = document.createElement('div');
    // 화면 밖 왼쪽에 배치: left:0이면 1080px 요소가 문서 폭을 넓혀 가로 스크롤 + 화면 깜빡임 발생
    tempContainer.style.cssText = 'position:absolute;left:-2000px;top:0;pointer-events:none;';
    document.body.appendChild(tempContainer);

    let root: ReturnType<typeof createRoot> | null = null;
    try {
      root = createRoot(tempContainer);
      flushSync(() => {
        root!.render(createElement(DrawShareImage, props));
      });

      // Ensure browser has painted
      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()));
      });
      // Extra safety delay for iOS Safari
      await new Promise((r) => setTimeout(r, 100));

      const target = tempContainer.firstElementChild as HTMLElement;
      if (!target) return null;

      const canvas = await html2canvas(target, {
        backgroundColor: '#0F0F0F',
        scale: 2,
        useCORS: true,
        logging: false,
        windowWidth: 1200,
      });

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png')
      );
      return blob;
    } finally {
      if (root) root.unmount();
      if (tempContainer.parentNode) tempContainer.parentNode.removeChild(tempContainer);
    }
  };

  const handleShareDraw = async (draw: DrawData) => {
    setExportingImage(true);
    setExportingDrawId(draw.id);
    try {
      const blob = await generateDrawImage(draw);
      if (!blob) return;

      const file = new File([blob], `대진표_${matchTitle || 'draw'}.png`, { type: 'image/png' });
      const shareData = { files: [file] };

      if (typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `대진표_${matchTitle || 'draw'}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('이미지가 저장되었습니다');
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('Share failed:', e);
        toast.error('공유에 실패했습니다. 저장 버튼을 사용해주세요.');
      }
    } finally {
      setExportingImage(false);
      setExportingDrawId(null);
    }
  };

  const handleDownloadDraw = async (draw: DrawData) => {
    setExportingImage(true);
    setExportingDrawId(draw.id);
    try {
      const blob = await generateDrawImage(draw);
      if (!blob) return;

      {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `대진표_${matchTitle || 'draw'}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
      toast.success('이미지가 저장되었습니다');
    } catch (e) {
      console.error('Download failed:', e);
      toast.error('이미지 저장에 실패했습니다');
    } finally {
      setExportingImage(false);
      setExportingDrawId(null);
    }
  };

  // ── Participant chip renderer ──

  const renderParticipantChip = (p: Participant) => {
    const effectiveGender = getEffectiveGender(p);
    const isOverridden = genderOverrides[p.id] !== undefined;

    return (
      <div
        key={p.id}
        className={cn(
          'flex items-center gap-1.5 rounded-full pl-3 pr-1.5 py-1.5 border transition-colors',
          effectiveGender === 'M'
            ? 'bg-info/10 border-info/20 text-info'
            : effectiveGender === 'F'
              ? 'bg-pink-500/10 border-pink-500/20 text-pink-400'
              : 'bg-surface-elevated border-border text-muted-foreground',
          isOverridden && 'ring-1 ring-yellow-500/40'
        )}
      >
        <span className="text-sm font-medium text-foreground">{p.name}</span>
        {p.ntrp && (
          <span className="text-[10px] text-primary font-semibold">{p.ntrp}</span>
        )}
        {!p.user_id && (
          <span className="text-[10px] text-muted-foreground">(비회원)</span>
        )}
        {isOverridden && (
          <span className="text-[10px] text-yellow-400 font-semibold">(이동)</span>
        )}
        {canEditGames && !isEditBlocked && (
          <>
            {canManageDraw && (
              <button
                onClick={() => toggleGenderOverride(p)}
                title="성별 그룹 이동"
                aria-label="성별 그룹 이동"
                className="w-9 h-9 -m-1.5 flex items-center justify-center rounded-full hover:bg-yellow-500/20 transition-colors cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground hover:text-yellow-400" />
              </button>
            )}
            <button
              onClick={() => setSubstituteTarget(p)}
              title="대체 선수"
              aria-label="대체 선수 지정"
              className="w-9 h-9 -m-1.5 flex items-center justify-center rounded-full hover:bg-primary/20 transition-colors cursor-pointer"
            >
              <Replace className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
            </button>
            {canManageDraw && (
              <button
                onClick={() => handleRemoveParticipant(p.id, p.name)}
                aria-label="참가자 제외"
                className="w-9 h-9 -m-1.5 flex items-center justify-center rounded-full hover:bg-destructive/20 transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            )}
          </>
        )}
      </div>
    );
  };

  // Player select options for edit modal
  const playerOptions = participants.map((p) => ({
    value: p.id,
    label: `${p.drawName}${p.gender === 'M' ? ' (남)' : p.gender === 'F' ? ' (여)' : ''}`,
  }));

  // 하단 고정 "자동 생성" 바 노출 조건: 대진표가 아직 없고, 관리 가능하며, 수동 편집 중이 아닐 때
  // (생성 중에도 바를 유지해 레이아웃 점프 방지 — 버튼은 disabled로 잠김)
  const showGenerateBar =
    canManageDraw && !isEditBlocked && !loading && !manualMode && draws.length === 0;

  return (
    <>
      <TopBar title="대진표" backHref={`/clubs/${clubId}/matches/${matchId}`} />

      {/* Draw edit lock banner */}
      {isEditBlocked && (
        <div className="mx-4 mt-3 px-4 py-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
          <Lock className="w-4 h-4 text-yellow-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-yellow-300">
              {lockHolder}님이 대진표를 수정 중입니다
            </p>
            {lockStartTime && (
              <p className="text-xs text-yellow-400/70 mt-0.5">
                {new Date(lockStartTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}부터
              </p>
            )}
          </div>
        </div>
      )}
      {canManageDraw && !drawLocked && (
        <div className="mx-4 mt-3 px-4 py-2 rounded-xl bg-primary/5 border border-primary/20 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <p className="text-xs text-primary/80">수정 중</p>
        </div>
      )}
      {isMatchEnded && isOwnerOrAdmin && (
        <div className="mx-4 mt-3 px-4 py-2.5 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <p className="text-xs text-yellow-300/90">
            종료된 대진입니다 — 회장·운영진만 선수 교체·개별 경기 수정이 가능합니다 (재생성·삭제 불가)
          </p>
        </div>
      )}

      <div className={cn('px-4 py-4 space-y-4 animate-fade-in', showGenerateBar && 'pb-24')}>
        {/* ── Participants ── */}
        <Card variant="glass" padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              참가자 ({participants.length}명)
            </h3>
            {canManageDraw && !isEditBlocked && (
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
                    여 <span className="text-muted-foreground font-normal">{females.length}명</span>
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
        {canManageDraw && !isEditBlocked && (
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                    코트 수
                  </label>
                  <div className="h-11 rounded-xl border border-border bg-muted flex items-center justify-center text-sm font-medium text-foreground">
                    {matchCourtCount}
                  </div>
                </div>
                <div>
                  <label htmlFor="gamesPerCourt" className="block text-xs font-medium text-muted-foreground mb-1.5">
                    코트당 경기
                  </label>
                  <div className="flex items-center h-11 rounded-xl border border-border bg-muted overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setGamesPerCourt(Math.max(1, gamesPerCourt - 1))}
                      className="w-10 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-sm font-medium text-foreground">{gamesPerCourt}</span>
                    <button
                      type="button"
                      onClick={() => setGamesPerCourt(Math.min(50, gamesPerCourt + 1))}
                      className="w-10 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="gameDuration" className="block text-xs font-medium text-muted-foreground mb-1.5">
                    경기 시간(분)
                  </label>
                  <div className="flex items-center h-11 rounded-xl border border-border bg-muted overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setGameDuration(String(Math.max(10, Number(gameDuration) - 5)))}
                      className="w-10 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      −
                    </button>
                    <span className="flex-1 text-center text-sm font-medium text-foreground">{gameDuration}</span>
                    <button
                      type="button"
                      onClick={() => setGameDuration(String(Math.min(120, Number(gameDuration) + 5)))}
                      className="w-10 h-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="max-w-[200px]">
                <Input
                  id="startTime"
                  label="시작 시간"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
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
                <Button onClick={handleGenerate} disabled={generating || participants.length < 4} fullWidth size="sm">
                  {generating ? (
                    <RefreshCw className="w-4 h-4 animate-spin mr-1.5 shrink-0" />
                  ) : (
                    <Shuffle className="w-4 h-4 mr-1.5 shrink-0" />
                  )}
                  {generating ? '생성 중...' : '자동 생성'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={initManualMode}
                  disabled={participants.length < 2}
                  fullWidth
                  size="sm"
                >
                  <PenLine className="w-4 h-4 mr-1.5 shrink-0" />
                  <span className="truncate">수동으로 만들기</span>
                </Button>
              </div>
              {participants.length < 4 && (
                <p className="text-xs text-muted-foreground text-center">복식 경기를 위해 최소 4명이 필요합니다</p>
              )}
            </div>
          </Card>
        )}

        {/* ── Manual Draw Editor ── */}
        {manualMode && canManageDraw && !isEditBlocked && (
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
          <div id="draw-results" className="space-y-4">
            {draws.map((draw) => {
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
                      {(() => {
                        // 저장된 draw_type(생성 모드)은 개별 게임을 수정해도 안 바뀌어
                        // 오해를 준다. 실제 게임들의 성별 구성으로 라이브 요약을 만든다.
                        const gs = draw.games || [];
                        let mens = 0, womens = 0, mixed = 0, free = 0;
                        for (const g of gs) {
                          const ids = [g.team_a_player1_id, g.team_a_player2_id, g.team_b_player1_id, g.team_b_player2_id].filter(Boolean) as string[];
                          const genders = ids.map((id) => participantMap[id]?.gender).filter(Boolean);
                          const m = genders.filter((x) => x === 'M').length;
                          const f = genders.filter((x) => x === 'F').length;
                          if (m > 0 && f > 0) mixed++;
                          else if (m > 0) mens++;
                          else if (f > 0) womens++;
                          else free++;
                        }
                        const parts: string[] = [];
                        if (mens) parts.push(`남복 ${mens}`);
                        if (womens) parts.push(`여복 ${womens}`);
                        if (mixed) parts.push(`혼복 ${mixed}`);
                        if (free) parts.push(`자유 ${free}`);
                        return parts.join(' · ') || mapDrawTypeFromApi(draw.draw_type);
                      })()} · {matchCourtCount}코트 · {(draw.games || []).length}경기 · {(() => {
                        const firstSlot = timeSlots[sortedOrders[0]];
                        const lastSlot = timeSlots[sortedOrders[sortedOrders.length - 1]];
                        return `${firstSlot?.startTime || '--:--'}~${lastSlot?.endTime || '--:--'}`;
                      })()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap justify-end">
                    {/* Image export buttons */}
                    <button
                      onClick={() => handleShareDraw(draw)}
                      disabled={exportingImage}
                      className="flex items-center gap-1 text-xs text-foreground font-medium px-2.5 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {exportingImage && exportingDrawId === draw.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Share2 className="w-3.5 h-3.5" />
                      )}
                      공유
                    </button>
                    <button
                      onClick={() => handleDownloadDraw(draw)}
                      disabled={exportingImage}
                      className="flex items-center gap-1 text-xs text-foreground font-medium px-2.5 py-1.5 rounded-lg hover:bg-surface-elevated transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Download className="w-3.5 h-3.5" />
                      저장
                    </button>
                    {canManageDraw && !isEditBlocked && (
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
                    const sitOutNames = sitOuts.map((p) => p.drawName);

                    return (
                      <GameRoundCard
                        key={order}
                        timeSlotIndex={order}
                        startTime={slot?.startTime || '--:--'}
                        endTime={slot?.endTime || '--:--'}
                        games={slotGames}
                        participantMap={participantMap}
                        courtNames={courtNames}
                        canManage={canEditGames && !isEditBlocked}
                        canInputScore={canInputScore}
                        sitOutNames={sitOutNames.length > 0 ? sitOutNames : undefined}
                        onEditGame={handleEditGame}
                        onDeleteGame={handleDeleteGame}
                        onAddGame={() => handleAddGame(draw.id, order)}
                        onScoreSaved={loadData}
                      />
                    );
                  })}

                  {/* 새 시간대(경기) 추가 */}
                  {canEditGames && !isEditBlocked && (
                    <button
                      onClick={() => handleAddGame(draw.id, (sortedOrders[sortedOrders.length - 1] || 0) + 1)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-border text-sm text-muted-foreground hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      새 시간대 경기 추가
                    </button>
                  )}
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
            })}
          </div>
        )}
      </div>

      {/* ── 하단 고정 자동 생성 바 ── */}
      {showGenerateBar && (
        <div
          className="hide-on-keyboard fixed left-0 right-0 z-30"
          style={{ bottom: 'calc(88px + env(safe-area-inset-bottom))' }}
        >
          <div className="max-w-lg mx-auto px-4">
            <Button
              onClick={handleGenerate}
              disabled={generating || participants.length < 4}
              fullWidth
              className="shadow-lg shadow-primary/30"
            >
              <Shuffle className="w-4 h-4 mr-1.5 shrink-0" />
              자동 생성
            </Button>
          </div>
        </div>
      )}

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

      {/* ── Add participant modal ── */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setMemberSearch(''); }} title="참가자 추가">
        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-muted mb-4">
          <button
            type="button"
            onClick={() => setAddTab('member')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
              addTab === 'member'
                ? 'bg-surface-elevated text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            클럽 멤버
          </button>
          <button
            type="button"
            onClick={() => setAddTab('offline')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all cursor-pointer',
              addTab === 'offline'
                ? 'bg-surface-elevated text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <UserPlus className="w-3.5 h-3.5" />
            직접 입력
          </button>
        </div>

        {/* Member tab */}
        {addTab === 'member' && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="멤버 검색..."
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              />
            </div>
            <div className="max-h-60 overflow-y-auto space-y-1.5">
              {loadingMembers ? (
                <p className="text-sm text-muted-foreground text-center py-6">로딩 중...</p>
              ) : (clubMembers.filter(m => !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()))).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {memberSearch ? '검색 결과가 없습니다' : '추가 가능한 멤버가 없습니다'}
                </p>
              ) : (
                clubMembers
                  .filter(m => !memberSearch || m.name.toLowerCase().includes(memberSearch.toLowerCase()))
                  .map((m) => (
                    <button
                      key={m.userId}
                      type="button"
                      onClick={() => handleAddMember(m.userId)}
                      disabled={adding}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border border-border',
                        'hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer',
                        'disabled:opacity-40 disabled:pointer-events-none'
                      )}
                    >
                      <div
                        className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0',
                          m.gender === 'M'
                            ? 'bg-info/15 text-info'
                            : m.gender === 'F'
                              ? 'bg-pink-500/15 text-pink-400'
                              : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '?'}
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-sm font-medium text-foreground">{m.name}</p>
                        {m.ntrp && (
                          <p className="text-xs text-primary font-semibold">NTRP {m.ntrp}</p>
                        )}
                      </div>
                    </button>
                  ))
              )}
            </div>
          </div>
        )}

        {/* Offline tab */}
        {addTab === 'offline' && (
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
        )}
      </Modal>

      {/* ── Substitute player modal ── */}
      <SubstitutePlayerModal
        isOpen={!!substituteTarget}
        onClose={() => setSubstituteTarget(null)}
        clubId={clubId}
        matchId={matchId}
        excludeParticipantIds={participants.filter(p => p.user_id).map(p => p.user_id!)}
        targetPlayerName={substituteTarget?.name || ''}
        onSelectMember={handleSubstituteMember}
        onAddOffline={handleSubstituteOffline}
        loading={substituting}
      />

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

            <button
              onClick={() => { const g = editGame; setEditGame(null); if (g) handleDeleteGame(g); }}
              className="w-full flex items-center justify-center gap-1.5 text-xs text-destructive/80 hover:text-destructive py-1 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              이 경기 삭제
            </button>
          </div>
        )}
      </Modal>

      {/* ── Confirm action modal ── */}
      {confirmAction && (
        <Modal isOpen={!!confirmAction} onClose={() => setConfirmAction(null)} title="확인">
          <p className="text-sm text-muted-foreground mb-5">{confirmAction.message}</p>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setConfirmAction(null)}>취소</Button>
            <Button variant="destructive" fullWidth onClick={() => { confirmAction.onConfirm(); setConfirmAction(null); }}>확인</Button>
          </div>
        </Modal>
      )}

    </>
  );
}
