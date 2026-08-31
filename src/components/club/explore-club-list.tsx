'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/search/search-input';
import { SearchEmpty } from '@/components/search/search-empty';
import { REGIONS, getSigunguList } from '@/lib/constants/regions';
import { MapPin, Users, Clock, X } from 'lucide-react';
import { ClubAvatar } from '@/components/club/club-avatar';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState, useTransition } from 'react';
import { joinPublicClub, cancelJoinRequest } from '@/lib/actions/clubs';
import type { ClubJoinRequest } from '@/types';

const SIDO_CHIPS = [
  { key: 'all', label: '전체' },
  ...REGIONS.map((r) => ({ key: r.short, label: r.short })),
];

interface ExploreClubListProps {
  initialClubs: any[];
  initialQuery: string;
  initialRegion: string;
  memberClubIds?: string[];
  joinRequests?: Record<string, ClubJoinRequest>;
}

export function ExploreClubList({
  initialClubs,
  initialQuery,
  initialRegion,
  memberClubIds = [],
  joinRequests: initialJoinRequests = {},
}: ExploreClubListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clubs = initialClubs;
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelledIds, setCancelledIds] = useState<Set<string>>(new Set());
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [joinModalClubId, setJoinModalClubId] = useState<string | null>(null);
  const [joinIntroduction, setJoinIntroduction] = useState('');
  const toast = useToast();

  // 현재 선택된 시/도에서 시/군/구 칩 생성
  const currentSido = initialRegion.split(' ')[0] || 'all';
  const currentSigungu = initialRegion.includes(' ') ? initialRegion.split(' ').slice(1).join(' ') : 'all';

  const sigunguChips = useMemo(() => {
    if (currentSido === 'all') return [];
    const list = getSigunguList(currentSido);
    if (list.length === 0) return [];
    return [
      { key: 'all', label: '전체' },
      ...list.map((gu) => ({ key: gu, label: gu })),
    ];
  }, [currentSido]);

  function updateSearch(query: string, region: string) {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (region && region !== 'all') params.set('region', region);
    const qs = params.toString();
    router.push(`/clubs/explore${qs ? `?${qs}` : ''}`);
  }

  function handleQueryChange(query: string) {
    updateSearch(query, initialRegion);
  }

  function handleSidoChange(sido: string) {
    const query = searchParams.get('q') || '';
    updateSearch(query, sido);
  }

  function handleSigunguChange(sigungu: string) {
    const query = searchParams.get('q') || '';
    if (sigungu === 'all') {
      updateSearch(query, currentSido);
    } else {
      updateSearch(query, `${currentSido} ${sigungu}`);
    }
  }

  function openJoinModal(clubId: string) {
    setJoinModalClubId(clubId);
    setJoinIntroduction('');
  }

  function handleJoin(clubId: string) {
    setJoiningId(clubId);
    startTransition(async () => {
      try {
        const res = await joinPublicClub(clubId, joinIntroduction || undefined);
        if (res?.error) { toast.error(res.error); return; }
        setRequestedIds((prev) => new Set(prev).add(clubId));
        setJoinModalClubId(null);
        setJoinIntroduction('');
      } finally {
        setJoiningId(null);
      }
    });
  }

  function handleCancel(requestId: string, clubId: string) {
    setCancellingId(clubId);
    startTransition(async () => {
      try {
        const res = await cancelJoinRequest(requestId);
        if (res?.error) { toast.error(res.error); return; }
        setCancelledIds((prev) => new Set(prev).add(clubId));
      } finally {
        setCancellingId(null);
      }
    });
  }

  function getClubStatus(clubId: string): 'member' | 'pending' | 'rejected' | 'none' {
    if (memberClubIds.includes(clubId)) return 'member';
    if (requestedIds.has(clubId) && !cancelledIds.has(clubId)) return 'pending';
    if (cancelledIds.has(clubId)) return 'none';
    const request = initialJoinRequests[clubId];
    if (request?.status === 'pending') return 'pending';
    if (request?.status === 'rejected') return 'rejected';
    return 'none';
  }

  function renderJoinButton(club: any) {
    const status = getClubStatus(club.id);
    const request = initialJoinRequests[club.id];

    if (status === 'member') {
      return (
        <Badge variant="success">가입됨</Badge>
      );
    }

    if (status === 'pending') {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="warning" className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            승인 대기중
          </Badge>
          {request && (
            <button
              onClick={() => handleCancel(request.id, club.id)}
              disabled={cancellingId === club.id || isPending}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
              title="신청 취소"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      );
    }

    if (status === 'rejected') {
      return (
        <div className="flex items-center gap-2">
          <Badge variant="destructive" className="text-xs">거절됨</Badge>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openJoinModal(club.id)}
            disabled={joiningId === club.id || isPending}
          >
            재신청
          </Button>
        </div>
      );
    }

    return (
      <Button
        size="sm"
        onClick={() => openJoinModal(club.id)}
        disabled={joiningId === club.id || isPending}
      >
        {joiningId === club.id ? '신청 중...' : '가입 신청'}
      </Button>
    );
  }

  return (
    <div className="py-4 space-y-4">
      {/* 검색 */}
      <div className="px-4">
        <SearchInput
          placeholder="클럽 이름으로 검색"
          value={initialQuery}
          onChange={handleQueryChange}
        />
      </div>

      {/* 시/도 필터 — overflow를 위해 px-4를 직접 적용 */}
      <div className="overflow-x-auto scrollbar-hide px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
        <div className="flex gap-2 w-max pb-1">
          {SIDO_CHIPS.map((chip) => (
            <button
              key={chip.key}
              onClick={() => handleSidoChange(chip.key)}
              className={`flex-shrink-0 px-3.5 py-1.5 min-h-[44px] min-w-[44px] rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                currentSido === chip.key
                  ? 'bg-primary text-black shadow-[0_0_12px_rgba(0,230,118,0.25)]'
                  : 'bg-surface-elevated text-muted-foreground hover:bg-surface-hover hover:text-foreground'
              }`}
            >
              {chip.label}
            </button>
          ))}
        </div>
      </div>

      {/* 시/군/구 필터 (시/도 선택 시) */}
      {sigunguChips.length > 0 && (
        <div className="overflow-x-auto scrollbar-hide px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="flex gap-2 w-max pb-1">
            {sigunguChips.map((chip) => (
              <button
                key={chip.key}
                onClick={() => handleSigunguChange(chip.key)}
                className={`flex-shrink-0 px-3.5 py-1.5 min-h-[44px] min-w-[44px] rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                  currentSigungu === chip.key
                    ? 'bg-primary text-black shadow-[0_0_12px_rgba(0,230,118,0.25)]'
                    : 'bg-surface-elevated text-muted-foreground hover:bg-surface-hover hover:text-foreground'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 결과 */}
      <div className="px-4">
      {clubs.length === 0 ? (
        <SearchEmpty
          query={initialQuery}
          message="클럽을 찾을 수 없어요"
          description={
            initialQuery
              ? `"${initialQuery}"에 대한 공개 클럽이 없습니다.`
              : '조건에 맞는 공개 클럽이 없습니다.'
          }
        />
      ) : (
        <div className="space-y-3 stagger">
          <p className="text-sm text-muted-foreground">
            {clubs.length}개의 클럽
          </p>
          {clubs.map((club: any) => (
            <Card key={club.id} className="hover:border-primary/30 transition-all">
              <div className="flex items-start gap-3">
                <Link href={`/clubs/${club.id}`}>
                  <ClubAvatar logoUrl={club.logo_url} name={club.name} size="md" />
                </Link>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Link href={`/clubs/${club.id}`} className="hover:text-primary transition-colors">
                      <h4 className="font-semibold text-foreground truncate">{club.name}</h4>
                    </Link>
                  </div>
                  {club.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {club.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    {club.region && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {club.region}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {club.member_count}명
                    </span>
                  </div>
                  <div className="pt-1">
                    {renderJoinButton(club)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      </div>
      {/* Join Application Modal */}
      <Modal
        isOpen={!!joinModalClubId}
        onClose={() => { setJoinModalClubId(null); setJoinIntroduction(''); }}
        title="가입 신청"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              자기소개 <span className="text-muted-foreground font-normal">(선택)</span>
            </label>
            <textarea
              value={joinIntroduction}
              onChange={(e) => setJoinIntroduction(e.target.value)}
              placeholder="간단한 자기소개를 작성해주세요"
              maxLength={500}
              rows={3}
              className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {joinIntroduction.length}/500
            </p>
          </div>
          <Button
            fullWidth
            onClick={() => joinModalClubId && handleJoin(joinModalClubId)}
            loading={!!joiningId}
          >
            가입 신청
          </Button>
        </div>
      </Modal>
    </div>
  );
}
