'use client';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { FilterChips } from '@/components/search/filter-chips';
import { SearchEmpty } from '@/components/search/search-empty';
import { cn } from '@/lib/utils/cn';
import { formatDate, formatTime, formatMatchStatus, formatDDayWithStatus } from '@/lib/utils/format';
import { CalendarClock, History, MapPin, Trophy, Filter } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

interface MyMatchesTabsProps {
  upcoming: any[];
  history: any[];
}

const statusVariant: Record<string, 'primary' | 'success' | 'default' | 'destructive'> = {
  upcoming: 'primary',
  in_progress: 'success',
  completed: 'default',
  cancelled: 'destructive',
};

function MatchCard({ item }: { item: any }) {
  const match = item.matches;
  if (!match) return null;

  return (
    <Link href={`/clubs/${match.club_id}/matches/${match.id}`}>
      <Card className="hover:border-primary/30 transition-all active:scale-[0.99]">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
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
          </div>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{formatDate(match.match_date)}</span>
            {match.start_time && <span>{formatTime(match.start_time)}</span>}
          </div>
          {match.location && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {match.location}
            </p>
          )}
          <div className="flex items-center gap-2">
            <Badge variant="outline">{match.clubs?.name}</Badge>
            <Badge variant="outline">코트 {match.court_count}면</Badge>
          </div>
        </div>
      </Card>
    </Link>
  );
}

export function MyMatchesTabs({ upcoming, history }: MyMatchesTabsProps) {
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  const [selectedClub, setSelectedClub] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // 모든 매치에서 클럽 목록 추출
  const clubChips = useMemo(() => {
    const allItems = [...upcoming, ...history];
    const clubMap = new Map<string, string>();
    allItems.forEach((item: any) => {
      const match = item.matches;
      if (match?.clubs) {
        clubMap.set(match.club_id, match.clubs.name);
      }
    });
    const chips = [{ key: 'all', label: '전체 클럽' }];
    clubMap.forEach((name, id) => {
      chips.push({ key: id, label: name });
    });
    return chips;
  }, [upcoming, history]);

  const tabs = [
    { key: 'upcoming' as const, label: '예정된 경기', icon: CalendarClock, count: upcoming.length },
    { key: 'history' as const, label: '경기 기록', icon: History, count: history.length },
  ];

  const currentList = activeTab === 'upcoming' ? upcoming : history;

  const filteredList = useMemo(() => {
    return currentList.filter((item: any) => {
      const match = item.matches;
      if (!match) return false;

      // 클럽 필터
      if (selectedClub !== 'all' && match.club_id !== selectedClub) return false;

      // 날짜 범위 필터
      if (startDate && match.match_date < startDate) return false;
      if (endDate && match.match_date > endDate) return false;

      return true;
    });
  }, [currentList, selectedClub, startDate, endDate]);

  const hasFilters = selectedClub !== 'all' || startDate || endDate;

  return (
    <div>
      {/* Tab Bar */}
      <div className="flex border-b border-border sticky top-14 glass z-20">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors relative',
              activeTab === tab.key
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={cn(
                'ml-1 text-[10px] rounded-full px-1.5 py-0.5 font-semibold',
                activeTab === tab.key
                  ? 'bg-primary-dim text-primary'
                  : 'bg-surface-elevated text-muted-foreground'
              )}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-3">
        {/* 필터 토글 */}
        {(upcoming.length > 0 || history.length > 0) && (
          <div className="space-y-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-1.5 text-sm font-medium transition-colors',
                showFilters || hasFilters ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Filter className="w-4 h-4" />
              필터
              {hasFilters && (
                <span className="bg-primary text-black text-[10px] font-bold rounded-full px-1.5 py-0.5">
                  ON
                </span>
              )}
            </button>

            {showFilters && (
              <div className="space-y-3 animate-fade-in">
                {/* 클럽 필터 */}
                {clubChips.length > 2 && (
                  <FilterChips
                    chips={clubChips}
                    selected={selectedClub}
                    onChange={setSelectedClub}
                  />
                )}

                {/* 날짜 범위 필터 — iOS는 date input placeholder를 무시하므로 라벨 겹침 표시 */}
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      aria-label="시작일"
                      className="w-full min-w-0 h-9 px-3 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    />
                    {!startDate && (
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-subtle">
                        시작일
                      </span>
                    )}
                  </div>
                  <span className="flex items-center text-muted-foreground text-sm">~</span>
                  <div className="relative flex-1 min-w-0">
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      aria-label="종료일"
                      className="w-full min-w-0 h-9 px-3 rounded-xl border border-border bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    />
                    {!endDate && (
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-subtle">
                        종료일
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {filteredList.length === 0 ? (
          hasFilters ? (
            <SearchEmpty
              message="조건에 맞는 경기가 없어요"
              description="필터를 변경해보세요."
            />
          ) : (
            <div className="text-center py-16">
              {activeTab === 'upcoming' ? (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-primary-dim flex items-center justify-center mx-auto mb-5">
                    <CalendarClock className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-1.5">예정된 경기가 없어요</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">새 경기를 만들어보세요! 클럽에서 멤버들과 함께 경기에 참가해보세요.</p>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-primary-dim flex items-center justify-center mx-auto mb-5">
                    <Trophy className="w-7 h-7 text-primary" />
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-1.5">경기 기록이 없어요</p>
                  <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">경기를 완료하면 여기에 기록이 쌓여요. 첫 경기를 시작해보세요!</p>
                </>
              )}
            </div>
          )
        ) : (
          <div className="space-y-3 stagger">
            {filteredList.map((item: any) => (
              <MatchCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
