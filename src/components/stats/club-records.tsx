import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils/cn';
import type { ClubRecord } from '@/lib/queries/records';

interface ClubRecordsProps {
  records: ClubRecord[];
  className?: string;
}

export function ClubRecords({ records, className }: ClubRecordsProps) {
  if (records.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <p className="text-sm text-muted-foreground">아직 기록이 없어요</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2 stagger', className)}>
      {records.map((record) => (
        <Card
          key={record.type}
          padding="sm"
          className="border-[#FFD740]/15 hover:border-[#FFD740]/30 transition-all duration-300"
        >
          <div className="flex items-center gap-3">
            {/* Emoji */}
            <div className="w-10 h-10 rounded-xl bg-[#FFD740]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg">{record.emoji}</span>
            </div>

            {/* Record Info */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[#FFD740] font-medium">{record.title}</p>
              <div className="flex items-center gap-2 mt-1">
                <Avatar
                  src={record.holderAvatarUrl}
                  alt={record.holderName}
                  fallback={record.holderName}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {record.holderName}
                  </p>
                  {record.date && (
                    <p className="text-[10px] text-muted-foreground">{record.date}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Value */}
            <div className="text-right flex-shrink-0">
              <p className="text-lg font-bold text-[#FFD740]">{record.value}</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
