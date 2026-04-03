'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { Achievement, AchievementType } from '@/lib/queries/achievements';
import { X } from 'lucide-react';
import { useState } from 'react';

interface AchievementMeta {
  type: AchievementType;
  label: string;
  emoji: string;
  description: string;
  criteria: string;
}

interface AchievementInfoModalProps {
  allMeta: AchievementMeta[];
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

export function AchievementInfoButton({
  allMeta,
  achievements,
  className,
}: AchievementInfoModalProps) {
  const [open, setOpen] = useState(false);

  const achievementMap = new Map(achievements.map((a) => [a.type, a]));

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'text-xs text-primary/80 hover:text-primary transition-colors underline underline-offset-2 cursor-pointer',
          className
        )}
      >
        칭호 기준 보기
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md max-h-[80vh] animate-slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <Card variant="glass" padding="lg" className="overflow-hidden">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-foreground">
                  칭호 목록 & 기준
                </h2>
                <button
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-lg bg-surface-elevated flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto max-h-[60vh] pr-1 -mr-1">
                {allMeta.map((meta) => {
                  const holder = achievementMap.get(meta.type);
                  return (
                    <div
                      key={meta.type}
                      className={cn(
                        'p-3 rounded-xl bg-gradient-to-br border',
                        BADGE_COLORS[meta.type] ||
                          'from-gray-500/20 to-gray-600/20 border-gray-500/30'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-2xl leading-none mt-0.5">
                          {meta.emoji}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-foreground text-sm">
                            {meta.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                            {meta.criteria}
                          </p>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">
                              보유자
                            </span>
                            {holder ? (
                              <span className="text-xs font-medium text-foreground">
                                {holder.display_name}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 italic">
                                아직 없음
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
