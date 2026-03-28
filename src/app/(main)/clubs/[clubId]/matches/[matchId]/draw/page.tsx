'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Modal } from '@/components/ui/modal';
import { TopBar } from '@/components/layout/top-bar';
import { DRAW_TYPES, NTRP_LEVELS } from '@/lib/constants';
import { PlayerGameSummary } from '@/components/match/player-game-summary';
import { addOfflineParticipant, removeParticipant } from '@/lib/actions/matches';
import { deleteDraw } from '@/lib/actions/games';
import { createClient } from '@/lib/supabase/client';
import { hasPermission } from '@/lib/utils/permissions';
import { cn } from '@/lib/utils/cn';
import type { ClubRole } from '@/types';
import { EmptyState } from '@/components/ui/empty-state';
import { Shuffle, Check, RefreshCw, UserPlus, X, Users, Trash2, RotateCcw } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

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

export default function DrawPage() {
  const params = useParams();
  const matchId = params.matchId as string;
  const clubId = params.clubId as string;

  const [draws, setDraws] = useState<DrawData[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [participantMap, setParticipantMap] = useState<Record<string, Participant>>({});
  const [drawType, setDrawType] = useState('random');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [myRole, setMyRole] = useState<ClubRole | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addGender, setAddGender] = useState<string>('');
  const [addNtrp, setAddNtrp] = useState('');
  const [adding, setAdding] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [regenerating, setRegenerating] = useState<string | null>(null);

  const canManageDraw = hasPermission(myRole, 'draw.manage');

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

  const handleGenerate = async () => {
    if (participants.length < 4) {
      alert('복식 경기를 위해 최소 4명의 참가자가 필요합니다');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch('/api/draw/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, drawType, roundNumber: (draws.length || 0) + 1 }),
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

  const getPlayerName = (id: string | null) => id ? participantMap[id]?.name || '???' : '-';

  const getGamesByCourt = (games: GameData[]) => {
    const courts: Record<number, GameData[]> = {};
    games.forEach((g) => {
      if (!courts[g.court_number]) courts[g.court_number] = [];
      courts[g.court_number].push(g);
    });
    Object.values(courts).forEach((gs) => gs.sort((a, b) => a.game_order - b.game_order));
    return courts;
  };

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

  return (
    <>
      <TopBar title="대진표" backHref={`/clubs/${clubId}/matches/${matchId}`} />

      <div className="px-4 py-4 space-y-4 animate-fade-in">
        {/* Participants */}
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
              {/* Males */}
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

              {/* Females */}
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

              {/* Unknown gender */}
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

        {/* Generate Draw */}
        {canManageDraw && (
          <Card variant="glow" padding="lg">
            <h3 className="font-semibold text-foreground flex items-center gap-2 mb-4">
              <Shuffle className="w-4 h-4 text-primary" />
              대진표 생성
            </h3>
            <div className="space-y-3">
              <Select
                id="drawType"
                options={DRAW_TYPES.filter((d) => d.value !== 'manual').map((d) => ({ ...d }))}
                value={drawType}
                onChange={(e) => setDrawType(e.target.value)}
                placeholder="대진 방식 선택"
              />
              <Button onClick={handleGenerate} disabled={generating || participants.length < 4} fullWidth>
                {generating ? (
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Shuffle className="w-4 h-4 mr-2" />
                )}
                {generating ? '생성 중...' : `자동 생성 (${participants.length}명)`}
              </Button>
              {participants.length < 4 && (
                <p className="text-xs text-muted-foreground text-center">복식 경기를 위해 최소 4명이 필요합니다</p>
              )}
            </div>
          </Card>
        )}

        {/* Draw Results */}
        {!loading && draws.length === 0 ? (
          <EmptyState
            icon={Shuffle}
            title="아직 대진표가 없어요"
            description={canManageDraw
              ? '참가자를 확인하고 자동 생성해보세요'
              : '운영진이 대진표를 생성할 때까지 기다려주세요'
            }
          />
        ) : (
          draws.map((draw) => {
            const courts = getGamesByCourt(draw.games || []);
            return (
              <div key={draw.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <span className="text-gradient">{draw.round_number}라운드</span>
                    <Badge variant="outline">
                      {DRAW_TYPES.find((d) => d.value === draw.draw_type)?.label || draw.draw_type}
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
                {Object.entries(courts).map(([courtNum, games]) => (
                  <Card key={courtNum} padding="sm" variant="glass">
                    <div className="bg-primary/10 rounded-lg px-3 py-2 mb-3 border border-primary/15">
                      <span className="text-sm font-semibold text-primary">코트 {courtNum}</span>
                    </div>
                    <div className="space-y-2">
                      {games.map((game, idx) => (
                        <div key={game.id} className="rounded-xl bg-surface-elevated border border-border p-3">
                          <div className="text-[10px] text-muted-foreground mb-2 font-medium">{idx + 1}경기</div>
                          <div className="flex items-center justify-between">
                            <div className="flex-1 text-center">
                              <div className="text-sm font-medium text-foreground">{getPlayerName(game.team_a_player1_id)}</div>
                              {game.team_a_player2_id && (
                                <div className="text-xs text-muted-foreground">{getPlayerName(game.team_a_player2_id)}</div>
                              )}
                            </div>
                            <div className="px-4 text-center">
                              {game.score_team_a !== null ? (
                                <span className="font-bold text-lg">
                                  <span className={game.winner === 'team_a' ? 'text-primary' : 'text-foreground'}>{game.score_team_a}</span>
                                  <span className="text-muted-foreground mx-1.5">:</span>
                                  <span className={game.winner === 'team_b' ? 'text-primary' : 'text-foreground'}>{game.score_team_b}</span>
                                </span>
                              ) : (
                                <span className="text-xs text-primary font-bold tracking-wider">VS</span>
                              )}
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-sm font-medium text-foreground">{getPlayerName(game.team_b_player1_id)}</div>
                              {game.team_b_player2_id && (
                                <div className="text-xs text-muted-foreground">{getPlayerName(game.team_b_player2_id)}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </Card>
                ))}

                {/* Player Game Summary */}
                {(draw.games || []).length > 0 && (
                  <PlayerGameSummary
                    games={draw.games || []}
                    participantMap={participantMap}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Delete draw confirmation modal */}
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

      {/* Add offline participant modal */}
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

          {/* Gender selection */}
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
    </>
  );
}
