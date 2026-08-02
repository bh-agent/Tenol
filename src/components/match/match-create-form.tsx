'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createMatch } from '@/lib/actions/matches';
import { MATCH_FORMATS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';
import {
  CalendarPlus,
  ChevronDown,
  Clock,
  LayoutGrid,
  MapPin,
  Search,
  Users,
  X,
} from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';

interface ClubMemberInfo {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  ntrp_level: number | null;
  gender: 'M' | 'F' | null;
}

interface OfflineParticipant {
  name: string;
  gender: 'M' | 'F';
  ntrp?: number;
}

interface MatchCreateFormProps {
  clubId: string;
  members: ClubMemberInfo[];
}

type ParticipantTab = 'members' | 'offline';

export function MatchCreateForm({ clubId, members }: MatchCreateFormProps) {
  const [isPending, startTransition] = useTransition();
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [offlineParticipants, setOfflineParticipants] = useState<OfflineParticipant[]>([]);
  const [activeTab, setActiveTab] = useState<ParticipantTab>('members');
  const [memberSearch, setMemberSearch] = useState('');
  // 참가자 사전 선택 섹션 접기/펼치기 (기본: 접힘)
  const [showParticipants, setShowParticipants] = useState(false);

  // Offline participant mini-form state
  const [offlineName, setOfflineName] = useState('');
  const [offlineGender, setOfflineGender] = useState<'M' | 'F'>('M');
  const [offlineNtrp, setOfflineNtrp] = useState('');

  const filteredMembers = useMemo(() => {
    if (!memberSearch.trim()) return members;
    const q = memberSearch.trim().toLowerCase();
    return members.filter((m) => m.display_name.toLowerCase().includes(q));
  }, [members, memberSearch]);

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const addOfflineParticipant = () => {
    const name = offlineName.trim();
    if (!name) return;
    setOfflineParticipants((prev) => [
      ...prev,
      {
        name,
        gender: offlineGender,
        ...(offlineNtrp ? { ntrp: parseFloat(offlineNtrp) } : {}),
      },
    ]);
    setOfflineName('');
    setOfflineNtrp('');
  };

  const removeOfflineParticipant = (index: number) => {
    setOfflineParticipants((prev) => prev.filter((_, i) => i !== index));
  };

  const hasParticipants = selectedMembers.size > 0 || offlineParticipants.length > 0;

  const participantsJson = hasParticipants
    ? JSON.stringify({
        members: [...selectedMembers],
        offline: offlineParticipants,
      })
    : '';

  const handleSubmit = (formData: FormData) => {
    startTransition(() => {
      createMatch(formData);
    });
  };

  return (
    <Card variant="glass" padding="lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <CalendarPlus className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">새 경기</h3>
          <p className="text-xs text-muted-foreground">경기 정보를 입력해주세요</p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-5">
        <input type="hidden" name="club_id" value={clubId} />
        {hasParticipants && (
          <input type="hidden" name="participants" value={participantsJson} />
        )}

        <Input
          id="title"
          name="title"
          label="경기 제목"
          placeholder="예: 3월 정기 모임"
          required
        />

        {/* Date & Time section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 text-primary/70" />
            <span className="font-medium">일시</span>
          </div>
          <Input
            id="match_date"
            name="match_date"
            label="날짜"
            type="date"
            required
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="start_time"
              name="start_time"
              label="시작 시간"
              type="time"
            />
            <Input
              id="end_time"
              name="end_time"
              label="종료 시간"
              type="time"
            />
          </div>
        </div>

        {/* Location section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary/70" />
            <span className="font-medium">장소</span>
          </div>
          <Input
            id="location"
            name="location"
            label="장소"
            placeholder="예: 올림픽공원 테니스코트"
          />
        </div>

        {/* Court & participants section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LayoutGrid className="w-4 h-4 text-primary/70" />
            <span className="font-medium">경기 설정</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="court_count"
              name="court_count"
              label="코트 수"
              type="number"
              min={1}
              max={20}
              defaultValue={1}
            />
            <Input
              id="max_participants"
              name="max_participants"
              label="최대 인원"
              type="number"
              min={2}
              placeholder="제한 없음"
            />
          </div>
          <Select
            id="format"
            name="format"
            label="경기 형식"
            options={[...MATCH_FORMATS]}
            defaultValue="doubles"
          />
        </div>

        <Input
          id="description"
          name="description"
          label="설명 (선택)"
          placeholder="추가 안내 사항"
        />

        {/* Participant pre-selection section (기본 접힘) */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowParticipants((prev) => !prev)}
            aria-expanded={showParticipants}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-surface border border-border transition-colors hover:border-border/80 cursor-pointer"
          >
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <Users className="w-4 h-4 text-primary/70" />
              참가자 미리 선택 (선택)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">나중에 추가할 수 있어요</span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-muted-foreground transition-transform duration-200',
                  showParticipants && 'rotate-180'
                )}
              />
            </span>
          </button>

          {showParticipants && (
          <>
          {/* Tab toggle */}
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('members')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer',
                activeTab === 'members'
                  ? 'bg-primary text-black'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              클럽 멤버
              {selectedMembers.size > 0 && (
                <span className="ml-1.5 text-xs">({selectedMembers.size})</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('offline')}
              className={cn(
                'flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer',
                activeTab === 'offline'
                  ? 'bg-primary text-black'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              직접 입력
              {offlineParticipants.length > 0 && (
                <span className="ml-1.5 text-xs">({offlineParticipants.length})</span>
              )}
            </button>
          </div>

          {/* Tab content: Members */}
          {activeTab === 'members' && (
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="멤버 검색..."
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  className={cn(
                    'w-full h-10 pl-9 pr-4 rounded-xl',
                    'bg-muted border border-border text-foreground text-sm',
                    'placeholder:text-subtle',
                    'transition-all duration-200',
                    'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50'
                  )}
                />
              </div>

              {selectedMembers.size > 0 && (
                <p className="text-xs text-primary font-medium">
                  {selectedMembers.size}명 선택됨
                </p>
              )}

              {/* Member list */}
              <div className="max-h-60 overflow-y-auto space-y-1 rounded-xl border border-border bg-muted/30 p-2">
                {filteredMembers.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    {memberSearch ? '검색 결과가 없습니다' : '멤버가 없습니다'}
                  </p>
                ) : (
                  filteredMembers.map((member) => {
                    const isSelected = selectedMembers.has(member.user_id);
                    return (
                      <button
                        key={member.user_id}
                        type="button"
                        onClick={() => toggleMember(member.user_id)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 cursor-pointer',
                          isSelected
                            ? 'bg-primary/10 border border-primary/30'
                            : 'hover:bg-surface-elevated border border-transparent'
                        )}
                      >
                        {/* Checkbox */}
                        <div
                          className={cn(
                            'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all duration-200',
                            isSelected
                              ? 'bg-primary border-primary'
                              : 'border-border'
                          )}
                        >
                          {isSelected && (
                            <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>

                        <Avatar
                          src={member.avatar_url}
                          alt={member.display_name}
                          size="sm"
                          fallback={member.display_name}
                        />

                        <span className="text-sm font-medium text-foreground truncate flex-1 text-left">
                          {member.display_name}
                        </span>

                        {member.ntrp_level && (
                          <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                            {member.ntrp_level}
                          </Badge>
                        )}

                        {member.gender && (
                          <span
                            className={cn(
                              'text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0',
                              member.gender === 'M'
                                ? 'bg-blue-500/15 text-blue-400'
                                : 'bg-pink-500/15 text-pink-400'
                            )}
                          >
                            {member.gender === 'M' ? '남' : '여'}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Tab content: Offline */}
          {activeTab === 'offline' && (
            <div className="space-y-3">
              {/* Mini add form */}
              <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-3">
                <Input
                  id="offline_name"
                  label="이름"
                  placeholder="참가자 이름"
                  value={offlineName}
                  onChange={(e) => setOfflineName(e.target.value)}
                />

                {/* Gender toggle */}
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">
                    성별
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setOfflineGender('M')}
                      className={cn(
                        'flex-1 h-10 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                        offlineGender === 'M'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                          : 'bg-muted text-muted-foreground border border-border hover:border-border/80'
                      )}
                    >
                      남성 (M)
                    </button>
                    <button
                      type="button"
                      onClick={() => setOfflineGender('F')}
                      className={cn(
                        'flex-1 h-10 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer',
                        offlineGender === 'F'
                          ? 'bg-pink-500/20 text-pink-400 border border-pink-500/40'
                          : 'bg-muted text-muted-foreground border border-border hover:border-border/80'
                      )}
                    >
                      여성 (F)
                    </button>
                  </div>
                </div>

                <Input
                  id="offline_ntrp"
                  label="NTRP (선택)"
                  type="number"
                  step="0.5"
                  min={1}
                  max={7}
                  placeholder="예: 3.5"
                  value={offlineNtrp}
                  onChange={(e) => setOfflineNtrp(e.target.value)}
                />

                <Button
                  type="button"
                  variant="secondary"
                  fullWidth
                  size="sm"
                  onClick={addOfflineParticipant}
                  disabled={!offlineName.trim()}
                >
                  추가
                </Button>
              </div>

              {/* Added participants as chips */}
              {offlineParticipants.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {offlineParticipants.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-elevated border border-border text-sm text-foreground"
                    >
                      <span
                        className={cn(
                          'text-[10px] font-bold',
                          p.gender === 'M' ? 'text-blue-400' : 'text-pink-400'
                        )}
                      >
                        {p.gender === 'M' ? '남' : '여'}
                      </span>
                      {p.name}
                      {p.ntrp && (
                        <span className="text-xs text-primary">{p.ntrp}</span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeOfflineParticipant(i)}
                        className="ml-0.5 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
          </>
          )}
        </div>

        <div className="pt-4">
          <Button type="submit" fullWidth size="lg" loading={isPending}>
            경기 만들기
          </Button>
        </div>
      </form>
    </Card>
  );
}
