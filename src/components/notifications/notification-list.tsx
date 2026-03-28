'use client';

import { markAllAsRead } from '@/lib/actions/notifications';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { NotificationItem } from './notification-item';
import type { Notification } from '@/types';
import { Bell, CheckCheck } from 'lucide-react';
import { useTransition } from 'react';

interface NotificationListProps {
  notifications: Notification[];
  hasUnread: boolean;
}

export function NotificationList({ notifications, hasUnread }: NotificationListProps) {
  const [isPending, startTransition] = useTransition();

  const handleMarkAllRead = () => {
    startTransition(async () => {
      await markAllAsRead();
    });
  };

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="알림이 없습니다"
        description="클럽 활동, 경기 초대 등의 알림이 여기에 표시됩니다"
      />
    );
  }

  return (
    <div>
      {hasUnread && (
        <div className="px-4 py-2 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
            disabled={isPending}
            className="text-primary hover:text-primary hover:bg-primary-dim"
          >
            <CheckCheck className="w-4 h-4 mr-1.5" />
            {isPending ? '처리 중...' : '모두 읽음'}
          </Button>
        </div>
      )}
      <div className="divide-y divide-border">
        {notifications.map((notification) => (
          <NotificationItem key={notification.id} notification={notification} />
        ))}
      </div>
    </div>
  );
}
