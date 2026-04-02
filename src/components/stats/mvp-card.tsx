'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { MvpEntry, MvpPeriod } from '@/lib/queries/mvp';
import { Crown, Trophy } from 'lucide-react';
import { useState } from 'react';

const PERIOD_LABELS: Record<MvpPeriod, string> = {
  match: '경기',
  week: '주간',
  month: '월간',
  year: '연간',
  all: '전체',
};

const MEDAL_EMOJI = ['👑', '🥈', '🥉'];
const MEDAL_COLORS = ['#FFD740', '#C0C0C0', '#CD7F32'];

interface MvpCardProps {
  /** MVP entries keyed by period. Pre-fetched from the server. */
  mvpByPeriod: Partial<Record<MvpPeriod, MvpEntry[] | MvpEntry | null>>;
  /** Which periods to show tabs for */
  periods?: MvpPeriod[];
  className?: string;
}

export function MvpCard({
  mvpByPeriod,
  periods = ['week', 'month', 'year', 'all'],
  className,
}: MvpCardProps) {
  const [activePeriod, setActivePeriod] = useState<MvpPeriod>(
    periods.includes('month') ? 'month' : periods[0]
  );

  // 배열 또는 단일 MvpEntry 처리 (하위 호환)
  const raw = mvpByPeriod[activePeriod];
  const mvpList: MvpEntry[] = Array.isArray(raw) ? raw : raw ? [raw] : [];

  return (
    <Card
      variant="glass"
      padding="lg"
      className={cn('relative overflow-hidden', className)}
    >
      {/* Gold glow background */}
      <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#FFD740]/8 blur-2xl pointer-events-none" />
      <div className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full bg-[#FFD740]/5 blur-xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-2 mb-4 relative">
        <div className="w-9 h-9 rounded-xl bg-[#FFD740]/15 flex items-center justify-center">
          <Trophy className="w-5 h-5 text-[#FFD740]" />
        </div>
        <div>
          <h3 className="font-bold text-foreground text-base">MVP Top 3</h3>
          <p className="text-[11px] text-muted-foreground">
            {PERIOD_LABELS[activePeriod]} 평균 득점 기준
          </p>
        </div>
      </div>

      {/* Period selector tabs */}
      <div className="flex gap-1 mb-5 bg-surface-elevated/50 rounded-xl p-1 relative">
        {periods.map((period) => (
          <button
            key={period}
            onClick={() => setActivePeriod(period)}
            className={cn(
              'flex-1 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer',
              activePeriod === period
                ? 'bg-[#FFD740]/15 text-[#FFD740] shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {PERIOD_LABELS[period]}
          </button>
        ))}
      </div>

      {/* MVP Top 3 Display */}
      {mvpList.length > 0 ? (
        <div className="space-y-3 relative">
          {mvpList.map((mvp, i) => {
            const avgScore = mvp.games_played > 0
              ? Math.round((mvp.total_score / mvp.games_played) * 10) / 10
              : 0;
            return (
              <div
                key={mvp.user_id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl',
                  i === 0 ? 'bg-[#FFD740]/8 border border-[#FFD740]/20' : 'bg-surface-elevated/50'
                )}
              >
                {/* Medal */}
                <span className="text-xl w-8 text-center flex-shrink-0">{MEDAL_EMOJI[i] || `${i + 1}`}</span>

                {/* Avatar */}
                <div className="relative">
                  <Avatar
                    src={mvp.avatar_url}
                    alt={mvp.display_name}
                    fallback={mvp.display_name}
                    size={i === 0 ? 'lg' : 'md'}
                    active={i === 0}
                  />
                  {i === 0 && (
                    <Crown className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[#FFD740] drop-shadow-[0_0_4px_rgba(255,215,64,0.5)]" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn('font-bold truncate', i === 0 ? 'text-base' : 'text-sm')} style={{ color: i < 3 ? MEDAL_COLORS[i] : undefined }}>
                      {mvp.display_name}
                    </p>
                    {mvp.ntrp_level && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                        {mvp.ntrp_level}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mvp.wins}승 · {mvp.games_played}경기 · 승률 {mvp.win_rate}%
                  </p>
                </div>

                {/* Avg Score */}
                <div className="text-right flex-shrink-0">
                  <p className="text-xl font-bold" style={{ color: MEDAL_COLORS[i] || '#EEEEEE' }}>
                    {avgScore}
                  </p>
                  <p className="text-[10px] text-muted-foreground">평균</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 relative">
          <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            아직 MVP가 없어요
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            최소 3경기 이상 참여가 필요합니다
          </p>
        </div>
      )}
    </Card>
  );
}

/** Compact MVP card for match results */
export function MatchMvpCard({
  mvp,
  className,
}: {
  mvp: MvpEntry;
  className?: string;
}) {
  return (
    <Card
      variant="glow"
      padding="md"
      className={cn('relative overflow-hidden', className)}
    >
      <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-[#FFD740]/8 blur-xl pointer-events-none" />

      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-[#FFD740]" />
        <span className="text-sm font-bold text-[#FFD740]">
          이 경기의 MVP
        </span>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#FFD740]/15 blur-sm scale-110" />
          <Avatar
            src={mvp.avatar_url}
            alt={mvp.display_name}
            fallback={mvp.display_name}
            size="lg"
            active
          />
          <Crown className="absolute -top-1.5 -right-1.5 w-4 h-4 text-[#FFD740] drop-shadow-[0_0_4px_rgba(255,215,64,0.5)]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-bold text-foreground truncate">
              {mvp.display_name}
            </p>
            {mvp.ntrp_level && (
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                {mvp.ntrp_level}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {mvp.total_score}점 | {mvp.wins}승 {mvp.games_played - mvp.wins}패
          </p>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xl font-bold text-[#FFD740]">
            {mvp.total_score}
          </p>
          <p className="text-[10px] text-muted-foreground">득점</p>
        </div>
      </div>
    </Card>
  );
}
