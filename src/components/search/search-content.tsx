'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { NTRP_LEVELS } from '@/lib/constants';
import { SIDO_SHORT_LIST } from '@/lib/constants/regions';
import { cn } from '@/lib/utils/cn';
import { MapPin, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Profile } from '@/types';

type SearchResult = Pick<
  Profile,
  'id' | 'display_name' | 'real_name' | 'avatar_url' | 'ntrp_level' | 'gender' | 'region' | 'bio'
>;

export function SearchContent() {
  const [query, setQuery] = useState('');
  const [ntrpFilter, setNtrpFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showNtrpDropdown, setShowNtrpDropdown] = useState(false);
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchResults = useCallback(async (q: string, ntrp: string, region: string, gender: string) => {
    // Need at least a query or one filter to search
    if (!q && !ntrp && !region && !gender) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      if (q) params.set('q', q);
      if (ntrp) params.set('ntrp', ntrp);
      if (region) params.set('region', region);
      if (gender) params.set('gender', gender);

      const res = await fetch(`/api/search?${params.toString()}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounced search on query change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchResults(query, ntrpFilter, regionFilter, genderFilter);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, ntrpFilter, regionFilter, genderFilter, fetchResults]);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick() {
      setShowNtrpDropdown(false);
      setShowRegionDropdown(false);
    }
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const clearQuery = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const activeFilterCount = [ntrpFilter, regionFilter, genderFilter].filter(Boolean).length;

  return (
    <div className="px-4 pt-3 animate-fade-in">
      {/* Search input - sticky */}
      <div className="sticky top-14 z-20 bg-background/80 backdrop-blur-xl pb-2 -mx-4 px-4 pt-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="이름으로 검색..."
            className="w-full h-11 pl-9 pr-9 rounded-xl bg-surface-elevated border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
          />
          {query && (
            <button
              onClick={clearQuery}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1">
          {/* NTRP dropdown */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setShowNtrpDropdown(!showNtrpDropdown);
                setShowRegionDropdown(false);
              }}
              className={cn(
                'flex items-center gap-1 h-8 px-3 rounded-full text-xs font-medium border whitespace-nowrap transition-all',
                ntrpFilter
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-surface-elevated text-muted-foreground border-border/50'
              )}
            >
              NTRP {ntrpFilter || '전체'}
              {ntrpFilter && (
                <X
                  className="w-3 h-3 ml-0.5"
                  onClick={(e) => { e.stopPropagation(); setNtrpFilter(''); }}
                />
              )}
            </button>
            {showNtrpDropdown && (
              <div className="absolute top-full left-0 mt-1 w-40 max-h-60 overflow-y-auto rounded-xl bg-surface-elevated border border-border/50 shadow-xl z-30">
                <button
                  onClick={() => { setNtrpFilter(''); setShowNtrpDropdown(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors',
                    !ntrpFilter && 'text-primary'
                  )}
                >
                  전체
                </button>
                {NTRP_LEVELS.map((level) => (
                  <button
                    key={level.value}
                    onClick={() => { setNtrpFilter(level.value); setShowNtrpDropdown(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors',
                      ntrpFilter === level.value && 'text-primary'
                    )}
                  >
                    {level.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Region dropdown */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => {
                setShowRegionDropdown(!showRegionDropdown);
                setShowNtrpDropdown(false);
              }}
              className={cn(
                'flex items-center gap-1 h-8 px-3 rounded-full text-xs font-medium border whitespace-nowrap transition-all',
                regionFilter
                  ? 'bg-primary/10 text-primary border-primary/30'
                  : 'bg-surface-elevated text-muted-foreground border-border/50'
              )}
            >
              {regionFilter || '지역'}
              {regionFilter && (
                <X
                  className="w-3 h-3 ml-0.5"
                  onClick={(e) => { e.stopPropagation(); setRegionFilter(''); }}
                />
              )}
            </button>
            {showRegionDropdown && (
              <div className="absolute top-full left-0 mt-1 w-36 max-h-60 overflow-y-auto rounded-xl bg-surface-elevated border border-border/50 shadow-xl z-30">
                <button
                  onClick={() => { setRegionFilter(''); setShowRegionDropdown(false); }}
                  className={cn(
                    'w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors',
                    !regionFilter && 'text-primary'
                  )}
                >
                  전체
                </button>
                {SIDO_SHORT_LIST.map((sido) => (
                  <button
                    key={sido}
                    onClick={() => { setRegionFilter(sido); setShowRegionDropdown(false); }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs hover:bg-white/5 transition-colors',
                      regionFilter === sido && 'text-primary'
                    )}
                  >
                    {sido}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Gender chips */}
          {(['전체', '남', '여'] as const).map((label) => {
            const value = label === '남' ? 'M' : label === '여' ? 'F' : '';
            const isActive = genderFilter === value;
            return (
              <button
                key={label}
                onClick={() => setGenderFilter(isActive ? '' : value)}
                className={cn(
                  'h-8 px-3 rounded-full text-xs font-medium border whitespace-nowrap transition-all',
                  isActive
                    ? 'bg-primary/10 text-primary border-primary/30'
                    : 'bg-surface-elevated text-muted-foreground border-border/50'
                )}
              >
                {label === '전체' ? '성별' : label}
              </button>
            );
          })}

          {/* Clear all filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => { setNtrpFilter(''); setRegionFilter(''); setGenderFilter(''); }}
              className="h-8 px-3 rounded-full text-xs font-medium text-destructive border border-destructive/30 bg-destructive/5 whitespace-nowrap transition-all hover:bg-destructive/10"
            >
              초기화
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="mt-2">
        {isLoading ? (
          <div className="space-y-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-3">
                <Skeleton className="w-10 h-10 rounded-full flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : !hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">검색어를 입력하세요</p>
            <p className="text-xs mt-1 opacity-60">이름 또는 필터로 유저를 찾아보세요</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm">검색 결과가 없습니다</p>
            <p className="text-xs mt-1 opacity-60">다른 검색어나 필터를 시도해보세요</p>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {results.map((user) => (
              <Link
                key={user.id}
                href={`/profile/${user.id}`}
                className="flex items-center gap-3 py-3 hover:bg-white/[0.02] transition-colors -mx-1 px-1 rounded-lg"
              >
                <Avatar
                  src={user.avatar_url}
                  alt={user.display_name}
                  fallback={user.display_name}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {user.display_name}
                    </span>
                    {user.ntrp_level && (
                      <Badge variant="primary" className="text-[10px] px-1.5 py-0">
                        NTRP {user.ntrp_level}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    {user.region && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {user.region}
                      </span>
                    )}
                    {user.gender && (
                      <span className={cn(
                        'text-xs',
                        user.gender === 'M' ? 'text-blue-400' : 'text-pink-400'
                      )}>
                        {user.gender === 'M' ? '남' : '여'}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
