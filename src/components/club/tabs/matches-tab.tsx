'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { SearchInput } from '@/components/search/search-input';
import { FilterChips } from '@/components/search/filter-chips';
import { SearchEmpty } from '@/components/search/search-empty';
import { formatDate, formatMatchStatus, formatTime, formatDDayWithStatus } from '@/lib/utils/format';
import { Calendar, Clock, MapPin, Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface MatchesTabProps {
  clubId: string;
  matches: any[];
  canCreateMatch: boolean;
  pendingGuestByMatch?: Record<string, number>;
}

const statusVariant: Record<string, 'primary' | 'success' | 'default' | 'destructive'> = {
  upcoming: 'primary',
  in_progress: 'success',
  completed: 'default',
  cancelled: 'destructive',
};

const STATUS_CHIPS = [
  { key: 'all', label: '전체' },
  { key: 'upcoming', label: '예정' },
  { key: 'in_progress', label: '진행 중' },
  { key: 'completed', label: '완료' },
  { key: 'cancelled', label: '취소' },
];

export function MatchesTab({ clubId, matches, canCreateMatch, pendingGuestByMatch }: MatchesTabProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const filteredMatches = useMemo(() => {
    return matches.filter((match: any) => {
      // 상태 필터
      if (statusFilter !== 'all' && match.status !== statusFilter) return false;

      // 검색어 필터
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        if (!match.title?.toLowerCase().includes(q)) return false;
      }

      // 날짜 범위 필터
      if (startDate && match.match_date < startDate) return false;
      if (endDate && match.match_date > endDate) return false;

      return true;
    });
  }, [matches, statusFilter, searchQuery, startDate, endDate]);

  const hasFilters = searchQuery || statusFilter !== 'all' || startDate || endDate;

  return (
    <div className="space-y-3">
      {canCreateMatch && (
        <Link href={`/clubs/${clubId}/matches/new`}>
          <button className="w-full border-2 border-dashed border-border rounded-2xl py-5 flex items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors active:scale-[0.98]">
            <Plus className="w-5 h-5" />
            <span className="text-sm font-medium">경기 만들기</span>
          </button>
        </Link>
      )}

      {/* 검색 및 필터 */}
      {matches.length > 0 && (
        <div className="space-y-3">
          <SearchInput
            placeholder="경기 제목으로 검색"
            value={searchQuery}
            onChange={setSearchQuery}
          />
          <FilterChips
            chips={STATUS_CHIPS}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="시작일"
              />
            </div>
            <span className="flex items-center text-muted-foreground text-sm">~</span>
            <div className="flex-1">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-border bg-surface text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="종료일"
              />
            </div>
          </div>
        </div>
      )}

      {filteredMatches.length === 0 ? (
        hasFilters ? (
          <SearchEmpty
            query={searchQuery}
            message="조건에 맞는 경기가 없어요"
            description="필터를 변경하거나 검색어를 수정해보세요."
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <div className="w-16 h-16 rounded-2xl bg-primary-dim flex items-center justify-center mx-auto mb-5">
              <Calendar className="w-7 h-7 text-primary" />
            </div>
            <p className="text-lg font-semibold text-foreground mb-1.5">예정된 경기가 없어요</p>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">
              {canCreateMatch
                ? '새 경기를 만들어보세요! 멤버들과 함께 코트에서 만나요.'
                : '운영진이 경기를 등록하면 여기에 표시됩니다.'}
            </p>
          </div>
        )
      ) : (
        <div className="stagger">
          {filteredMatches.map((match: any) => {
            const confirmedCount = match.match_participants?.filter(
              (p: any) => p.status === 'confirmed'
            ).length || 0;
            const pendingCount = pendingGuestByMatch?.[match.id] || 0;

            return (
              <Link key={match.id} href={`/clubs/${clubId}/matches/${match.id}`}>
                <Card className="hover:border-primary/30 transition-all active:scale-[0.99] mb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-medium text-foreground">{match.title}</h4>
                        <Badge variant={statusVariant[match.status] || 'default'}>
                          {formatMatchStatus(match.status)}
                        </Badge>
                        <Badge
                          variant={
                            match.status === 'completed' || match.status === 'cancelled'
                              ? 'default'
                              : formatDDayWithStatus(match.match_date, match.status) === '오늘'
                                ? 'success'
                                : match.status === 'in_progress'
                                  ? 'success'
                                  : 'warning'
                          }
                          className="text-[10px] px-1.5 py-0"
                        >
                          {formatDDayWithStatus(match.match_date, match.status)}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(match.match_date)}
                        {match.start_time && ` ${formatTime(match.start_time)}`}
                      </p>
                      {match.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {match.location}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm space-y-1">
                      <div>
                        <span className="text-primary font-semibold">{confirmedCount}명</span>
                        {match.max_participants && (
                          <span className="text-muted-foreground">/{match.max_participants}</span>
                        )}
                      </div>
                      {pendingCount > 0 && (
                        <Badge variant="warning" className="text-[10px] px-1.5 py-0 flex items-center gap-0.5">
                          <Clock className="w-2.5 h-2.5" />
                          대기 {pendingCount}
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
