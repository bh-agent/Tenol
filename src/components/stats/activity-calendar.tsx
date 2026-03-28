'use client';

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';

interface ActivityCalendarProps {
  /** Map of date string (YYYY-MM-DD) to game count */
  activityData: Record<string, number>;
  className?: string;
}

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function getIntensityClass(count: number): string {
  if (count === 0) return 'bg-surface-elevated';
  if (count === 1) return 'bg-[#00E676]/20';
  if (count === 2) return 'bg-[#00E676]/40';
  if (count <= 4) return 'bg-[#00E676]/60';
  return 'bg-[#00E676]/80';
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

export function ActivityCalendar({ activityData, className }: ActivityCalendarProps) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const monthLabel = `${year}년 ${month + 1}월`;

  // Build the calendar grid
  const cells: { day: number | null; dateStr: string | null }[] = [];

  // Empty cells before the first day
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: null, dateStr: null });
  }

  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    cells.push({ day, dateStr });
  }

  // Total games this month
  const totalGames = Object.entries(activityData)
    .filter(([date]) => date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`))
    .reduce((sum, [, count]) => sum + count, 0);

  const activeDays = Object.entries(activityData)
    .filter(
      ([date, count]) =>
        date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) && count > 0
    ).length;

  return (
    <Card variant="glass" padding="lg" className={cn('', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎾</span>
          <h3 className="text-base font-semibold text-foreground">{monthLabel} 활동</h3>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">
            {activeDays}일 / {totalGames}경기
          </p>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((label) => (
          <div
            key={label}
            className="text-[10px] text-muted-foreground text-center font-medium"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell, i) => {
          if (cell.day === null) {
            return <div key={`empty-${i}`} className="aspect-square" />;
          }

          const count = cell.dateStr ? activityData[cell.dateStr] || 0 : 0;
          const isToday =
            cell.day === now.getDate() &&
            month === now.getMonth() &&
            year === now.getFullYear();

          return (
            <div
              key={cell.dateStr}
              className={cn(
                'aspect-square rounded-md flex items-center justify-center text-[10px] font-medium transition-colors relative',
                getIntensityClass(count),
                isToday && 'ring-1 ring-primary ring-offset-1 ring-offset-card',
                count > 0 ? 'text-foreground' : 'text-muted-foreground/60'
              )}
              title={count > 0 ? `${cell.day}일: ${count}경기` : `${cell.day}일`}
            >
              {cell.day}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3">
        <span className="text-[9px] text-muted-foreground">적음</span>
        <div className="w-3 h-3 rounded-sm bg-surface-elevated" />
        <div className="w-3 h-3 rounded-sm bg-[#00E676]/20" />
        <div className="w-3 h-3 rounded-sm bg-[#00E676]/40" />
        <div className="w-3 h-3 rounded-sm bg-[#00E676]/60" />
        <div className="w-3 h-3 rounded-sm bg-[#00E676]/80" />
        <span className="text-[9px] text-muted-foreground">많음</span>
      </div>
    </Card>
  );
}
