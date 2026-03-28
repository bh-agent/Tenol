import { cn } from '@/lib/utils/cn';

interface WinRateChartProps {
  winRate: number;
  wins: number;
  losses: number;
  total: number;
  className?: string;
}

export function WinRateChart({ winRate, wins, losses, total, className }: WinRateChartProps) {
  if (total === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-sm text-muted-foreground">아직 경기 기록이 없어요</p>
      </div>
    );
  }

  const lossRate = total > 0 ? Math.round((losses / total) * 100) : 0;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Win Rate Circle */}
      <div className="flex items-center justify-center">
        <div className="relative w-32 h-32">
          {/* Background circle */}
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              className="text-surface-elevated"
            />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="currentColor"
              strokeWidth="10"
              strokeDasharray={`${(winRate / 100) * 327} 327`}
              strokeLinecap="round"
              className="text-primary transition-all duration-700"
              style={{ filter: 'drop-shadow(0 0 6px rgba(0, 230, 118, 0.4))' }}
            />
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-gradient">{winRate}%</span>
            <span className="text-[10px] text-muted-foreground">승률</span>
          </div>
        </div>
      </div>

      {/* Bar visualization */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">승리</span>
          <span className="font-semibold text-primary">{wins}승</span>
        </div>
        <div className="h-3 bg-surface-elevated rounded-full overflow-hidden flex">
          {winRate > 0 && (
            <div
              className="h-full bg-primary rounded-l-full transition-all duration-500"
              style={{
                width: `${winRate}%`,
                boxShadow: '0 0 8px rgba(0, 230, 118, 0.3)',
              }}
            />
          )}
          {lossRate > 0 && (
            <div
              className="h-full bg-destructive/60 rounded-r-full transition-all duration-500"
              style={{ width: `${lossRate}%` }}
            />
          )}
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">패배</span>
          <span className="font-semibold text-destructive">{losses}패</span>
        </div>
      </div>
    </div>
  );
}
