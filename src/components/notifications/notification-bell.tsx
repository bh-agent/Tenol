import { getUnreadCount } from '@/lib/queries/notifications';
import { Bell } from 'lucide-react';
import Link from 'next/link';

export async function NotificationBell() {
  const unreadCount = await getUnreadCount();

  return (
    <Link
      href="/notifications"
      className="relative p-2 rounded-full hover:bg-surface-elevated transition-colors"
      aria-label="알림"
    >
      <Bell className="w-5 h-5 text-foreground" />
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-primary text-black text-[10px] font-bold px-1 shadow-[0_0_8px_rgba(0,230,118,0.4)]">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
