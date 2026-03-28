'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { Select } from '@/components/ui/select';
import { NTRP_LEVELS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';
import { Search, UserPlus, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type ClubMemberOption = {
  id: string;
  userId: string;
  name: string;
  gender: 'M' | 'F' | null;
  ntrp: number | null;
};

type SubstitutePlayerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  matchId: string;
  excludeParticipantIds: string[]; // user_ids already in the match
  targetPlayerName: string; // name of the player being replaced
  onSelectMember: (member: ClubMemberOption) => void;
  onAddOffline: (name: string, gender: 'M' | 'F', ntrp?: number) => void;
  loading?: boolean;
};

export function SubstitutePlayerModal({
  isOpen,
  onClose,
  clubId,
  matchId,
  excludeParticipantIds,
  targetPlayerName,
  onSelectMember,
  onAddOffline,
  loading,
}: SubstitutePlayerModalProps) {
  const [tab, setTab] = useState<'member' | 'offline'>('member');
  const [members, setMembers] = useState<ClubMemberOption[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [search, setSearch] = useState('');

  // Offline form
  const [offlineName, setOfflineName] = useState('');
  const [offlineGender, setOfflineGender] = useState<string>('');
  const [offlineNtrp, setOfflineNtrp] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setTab('member');
    setSearch('');
    setOfflineName('');
    setOfflineGender('');
    setOfflineNtrp('');
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || tab !== 'member') return;
    const loadMembers = async () => {
      setLoadingMembers(true);
      const supabase = createClient();
      const { data } = await supabase
        .from('club_members')
        .select('user_id, profiles:user_id (display_name, gender, ntrp_level)')
        .eq('club_id', clubId);

      if (data) {
        const mapped: ClubMemberOption[] = data
          .map((m: any) => {
            const profile = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
            return {
              id: m.user_id,
              userId: m.user_id,
              name: profile?.display_name || '???',
              gender: profile?.gender || null,
              ntrp: profile?.ntrp_level || null,
            };
          })
          .filter((m: ClubMemberOption) => !excludeParticipantIds.includes(m.userId));
        setMembers(mapped);
      }
      setLoadingMembers(false);
    };
    loadMembers();
  }, [isOpen, tab, clubId, excludeParticipantIds]);

  const filteredMembers = search
    ? members.filter(m => m.name.toLowerCase().includes(search.toLowerCase()))
    : members;

  const handleSubmitOffline = () => {
    if (!offlineName.trim()) return;
    if (!offlineGender) return;
    onAddOffline(offlineName.trim(), offlineGender as 'M' | 'F', offlineNtrp ? Number(offlineNtrp) : undefined);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="대체 선수">
      <p className="text-sm text-muted-foreground mb-4">
        <span className="font-semibold text-foreground">{targetPlayerName}</span> 대신 참가할 선수를 선택하세요.
      </p>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-muted mb-4">
        <button
          type="button"
          onClick={() => setTab('member')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
            tab === 'member'
              ? 'bg-surface-elevated text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Users className="w-3.5 h-3.5" />
          클럽 멤버
        </button>
        <button
          type="button"
          onClick={() => setTab('offline')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer',
            tab === 'offline'
              ? 'bg-surface-elevated text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <UserPlus className="w-3.5 h-3.5" />
          직접 추가
        </button>
      </div>

      {tab === 'member' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="이름 검색..."
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5">
            {loadingMembers ? (
              <p className="text-sm text-muted-foreground text-center py-6">로딩 중...</p>
            ) : filteredMembers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                {search ? '검색 결과가 없습니다' : '선택 가능한 멤버가 없습니다'}
              </p>
            ) : (
              filteredMembers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMember(m)}
                  disabled={loading}
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

      {tab === 'offline' && (
        <div className="space-y-4">
          <Input
            id="sub_name"
            label="이름"
            placeholder="대체 선수 이름"
            value={offlineName}
            onChange={(e) => setOfflineName(e.target.value)}
            required
          />
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              성별 <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOfflineGender('M')}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer',
                  offlineGender === 'M'
                    ? 'border-info bg-info/15 text-info'
                    : 'border-border text-muted-foreground hover:border-foreground/30'
                )}
              >
                남성
              </button>
              <button
                type="button"
                onClick={() => setOfflineGender('F')}
                className={cn(
                  'h-11 rounded-xl border text-sm font-medium transition-all duration-200 cursor-pointer',
                  offlineGender === 'F'
                    ? 'border-pink-500 bg-pink-500/15 text-pink-400'
                    : 'border-border text-muted-foreground hover:border-foreground/30'
                )}
              >
                여성
              </button>
            </div>
          </div>
          <Select
            id="sub_ntrp"
            label="NTRP (선택)"
            options={NTRP_LEVELS.map((l) => ({ ...l }))}
            value={offlineNtrp}
            onChange={(e) => setOfflineNtrp(e.target.value)}
            placeholder="모르면 비워두세요"
          />
          <Button
            onClick={handleSubmitOffline}
            disabled={loading || !offlineName.trim() || !offlineGender}
            loading={loading}
            fullWidth
          >
            대체 선수 추가
          </Button>
        </div>
      )}
    </Modal>
  );
}
