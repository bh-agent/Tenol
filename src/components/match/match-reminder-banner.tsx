import { Bell, MapPin, Clock } from 'lucide-react';
import { formatTime } from '@/lib/utils/format';

interface MatchReminderBannerProps {
  matchDate: string;
  startTime?: string | null;
  location?: string | null;
}

export function MatchReminderBanner({ matchDate, startTime, location }: MatchReminderBannerProps) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(matchDate);
  const targetStart = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const diffDays = Math.round((targetStart.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || diffDays > 1) return null;

  const isToday = diffDays === 0;
  const message = isToday ? '오늘 경기 시작!' : '내일 경기가 있어요!';

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-primary/30 bg-primary/10 p-4 animate-fade-in">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0 animate-pulse">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 space-y-1.5">
          <p className="text-sm font-bold text-primary">{message}</p>
          <div className="flex flex-wrap gap-3 text-xs text-primary/80">
            {startTime && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatTime(startTime)}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {location}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
