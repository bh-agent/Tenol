'use client';

import { cn } from '@/lib/utils/cn';
import { markAsRead } from '@/lib/actions/notifications';
import { formatRelativeTime } from '@/lib/utils/format';
import type { Notification } from '@/types';
import {
  UserCheck,
  UserX,
  UserPlus,
  Shuffle,
  Trophy,
  Shield,
  Bell,
  Calendar,
  AtSign,
  Users,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  match_invite: { icon: Calendar, color: 'text-primary bg-primary-dim' },
  guest_approved: { icon: UserCheck, color: 'text-success bg-success/10' },
  guest_rejected: { icon: UserX, color: 'text-destructive bg-destructive/10' },
  match_reminder: { icon: Bell, color: 'text-warning bg-warning/10' },
  draw_published: { icon: Shuffle, color: 'text-primary bg-primary-dim' },
  score_updated: { icon: Trophy, color: 'text-warning bg-warning/10' },
  role_changed: { icon: Shield, color: 'text-primary bg-primary-dim' },
  new_follower: { icon: UserPlus, color: 'text-primary bg-primary-dim' },
  mention: { icon: AtSign, color: 'text-primary bg-primary-dim' },
  join_request: { icon: Users, color: 'text-warning bg-warning/10' },
  join_approved: { icon: UserCheck, color: 'text-success bg-success/10' },
  join_rejected: { icon: UserX, color: 'text-destructive bg-destructive/10' },
};

function getNotificationHref(notification: Notification): string | null {
  const { data } = notification;
  if (data.match_id && data.club_id) {
    return `/clubs/${data.club_id}/matches/${data.match_id}`;
  }
  if (data.club_id) {
    return `/clubs/${data.club_id}`;
  }
  if (data.follower_id) {
    return `/profile/${data.follower_id}`;
  }
  if (data.media_id) {
    return `/feed`;
  }
  return null;
}


interface NotificationItemProps {
  notification: Notification;
}

export function NotificationItem({ notification }: NotificationItemProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const config = typeConfig[notification.type] || { icon: Bell, color: 'text-muted-foreground bg-surface-elevated' };
  const Icon = config.icon;
  const href = getNotificationHref(notification);

  const handleClick = () => {
    startTransition(async () => {
      if (!notification.is_read) {
        await markAsRead(notification.id);
      }
      if (href) {
        router.push(href);
      }
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={cn(
        'w-full text-left px-4 py-3 flex items-start gap-3 transition-colors',
        notification.is_read
          ? 'bg-transparent'
          : 'bg-primary-dim',
        href && 'hover:bg-surface-elevated active:bg-surface-hover',
        isPending && 'opacity-60'
      )}
    >
      <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5', config.color)}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn(
            'text-sm leading-snug text-foreground',
            !notification.is_read && 'font-semibold'
          )}>
            {notification.title}
          </p>
          {!notification.is_read && (
            <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-1.5 shadow-[0_0_6px_rgba(0,230,118,0.5)]" />
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
          {notification.body}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {formatRelativeTime(notification.created_at)}
        </p>
      </div>
    </button>
  );
}
