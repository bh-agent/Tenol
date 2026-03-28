export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { NotificationList } from '@/components/notifications/notification-list';
import { getNotifications } from '@/lib/queries/notifications';
import { Bell } from 'lucide-react';

export default async function NotificationsPage() {
  const notifications = await getNotifications(100);
  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <>
      <TopBar title="알림" backHref="/clubs" />

      <div className="px-4 pt-4 pb-2 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-primary border-2 border-background animate-pulse" />
            )}
          </div>
          <div>
            <h2 className="font-semibold text-foreground">알림</h2>
            <p className="text-xs text-muted-foreground">
              {hasUnread ? '읽지 않은 알림이 있습니다' : '모든 알림을 확인했습니다'}
            </p>
          </div>
        </div>
      </div>

      <NotificationList notifications={notifications} hasUnread={hasUnread} />
    </>
  );
}
