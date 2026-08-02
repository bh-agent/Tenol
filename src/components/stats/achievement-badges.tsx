'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { Achievement } from '@/lib/queries/achievements';
import { X } from 'lucide-react';
import { useState } from 'react';

interface AchievementBadgesProps {
  achievements: Achievement[];
  className?: string;
}

const BADGE_COLORS: Record<string, string> = {
  current_mvp: 'from-yellow-500/20 to-amber-600/20 border-yellow-500/30',
  all_time_mvp: 'from-yellow-400/20 to-orange-500/20 border-yellow-400/30',
  most_games: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
  win_streak: 'from-red-500/20 to-orange-500/20 border-red-500/30',
  iron_man: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
  social_butterfly: 'from-pink-500/20 to-purple-500/20 border-pink-500/30',
  rookie_star: 'from-cyan-400/20 to-blue-400/20 border-cyan-400/30',
  ace: 'from-violet-500/20 to-purple-600/20 border-violet-500/30',
};

const VALUE_LABELS: Record<string, string> = {
  current_mvp: '점',
  all_time_mvp: '점',
  most_games: '경기',
  win_streak: '연승',
  iron_man: '매치',
  social_butterfly: '명',
  rookie_star: '% 승률',
  ace: '점',
};

export function AchievementBadges({
  achievements,
  className,
}: AchievementBadgesProps) {
  const [selectedBadge, setSelectedBadge] = useState<Achievement | null>(null);

  if (achievements.length === 0) return null;

  return (
    <>
      <div className={cn('relative', className)}>
        {/* Horizontal scroll strip */}
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory">
          {achievements.map((achievement) => (
            <button
              key={achievement.type}
              onClick={() => setSelectedBadge(achievement)}
              className={cn(
                'flex-shrink-0 snap-start flex items-center gap-2 px-3 py-2 rounded-xl',
                'bg-gradient-to-br border transition-all duration-200',
                'hover:scale-[1.02] active:scale-[0.98] cursor-pointer',
                BADGE_COLORS[achievement.type] || 'from-gray-500/20 to-gray-600/20 border-gray-500/30'
              )}
            >
              <span className="text-lg leading-none">{achievement.emoji}</span>
              <div className="text-left">
                <p className="text-xs font-semibold text-foreground whitespace-nowrap">
                  {achievement.label}
                </p>
                <p className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {achievement.display_name}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail overlay */}
      {selectedBadge && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 animate-fade-in"
          onClick={() => setSelectedBadge(null)}
        >
          <div
            className="w-full max-w-md mx-4 mb-4 animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <Card variant="glass" padding="lg">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedBadge.emoji}</span>
                  <div>
                    <h3 className="font-bold text-foreground text-base">
                      {selectedBadge.label}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {selectedBadge.description}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBadge(null)}
                  aria-label="닫기"
                  className="w-7 h-7 rounded-lg bg-surface-elevated flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Criteria */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 mb-3">
                <p className="text-xs font-medium text-primary/80 mb-1">획득 조건</p>
                <p className="text-sm text-foreground/80">
                  {selectedBadge.criteria}
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-elevated/50">
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    {selectedBadge.display_name}
                  </p>
                  <p className="text-xs text-muted-foreground">현재 보유자</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-primary">
                    {selectedBadge.value}
                    <span className="text-xs text-muted-foreground ml-0.5">
                      {VALUE_LABELS[selectedBadge.type] || ''}
                    </span>
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}

/** Compact inline badges for member lists (max 3) */
export function MemberAchievementBadges({
  achievements,
  className,
}: {
  achievements: Achievement[];
  className?: string;
}) {
  if (achievements.length === 0) return null;

  const shown = achievements.slice(0, 3);

  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      {shown.map((a) => (
        <span
          key={a.type}
          title={a.label}
          className="text-sm leading-none cursor-default"
        >
          {a.emoji}
        </span>
      ))}
    </span>
  );
}
