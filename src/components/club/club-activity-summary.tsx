import { Swords, UserPlus, Activity } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils/format';

interface ActivityItem {
  type: 'match_created' | 'member_joined';
  name: string;
  timestamp: string;
}

interface ClubActivitySummaryProps {
  matches: Array<{
    title: string;
    created_at: string;
    created_by?: string;
  }>;
  members: Array<{
    joined_at: string;
    profiles: {
      display_name?: string | null;
    } | null;
  }>;
}

export function ClubActivitySummary({ matches, members }: ClubActivitySummaryProps) {
  // Build activity list from matches and members
  const activities: ActivityItem[] = [];

  for (const match of matches.slice(0, 5)) {
    activities.push({
      type: 'match_created',
      name: match.title,
      timestamp: match.created_at,
    });
  }

  for (const member of members.slice(-5)) {
    if (member.profiles?.display_name) {
      activities.push({
        type: 'member_joined',
        name: member.profiles.display_name,
        timestamp: member.joined_at,
      });
    }
  }

  // Sort by timestamp descending, take 3
  activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const recent = activities.slice(0, 3);

  if (recent.length === 0) return null;

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'match_created':
        return <Swords className="w-3.5 h-3.5 text-primary" />;
      case 'member_joined':
        return <UserPlus className="w-3.5 h-3.5 text-primary" />;
    }
  };

  const getMessage = (item: ActivityItem) => {
    switch (item.type) {
      case 'match_created':
        return <>&quot;{item.name}&quot; 경기가 만들어졌어요</>;
      case 'member_joined':
        return <>새 멤버 {item.name}님이 가입했어요</>;
    }
  };

  return (
    <div className="px-4 py-2 animate-fade-in">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-3.5 h-3.5 text-primary/70" />
        <h3 className="text-sm font-semibold text-foreground">최근 활동</h3>
      </div>
      <div className="space-y-1.5">
        {recent.map((item, i) => (
          <div
            key={`${item.type}-${item.timestamp}-${i}`}
            className="flex items-start gap-2.5 p-2.5 rounded-xl bg-surface-elevated/50"
          >
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
              {getIcon(item.type)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground/90 leading-relaxed">
                {getMessage(item)}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatRelativeTime(item.timestamp)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
