'use client';

import { cn } from '@/lib/utils/cn';
import { Users, Trophy, Megaphone, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/clubs', label: '클럽', icon: Users },
  { href: '/my-matches', label: '내 경기', icon: Trophy },
  { href: '/recruit', label: '모집', icon: Megaphone },
  { href: '/profile', label: '프로필', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),8px)]">
      <div className="max-w-lg mx-auto glass border border-border/50 rounded-2xl">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive =
              item.href === '/clubs'
                ? pathname === '/clubs' || pathname.startsWith('/clubs/')
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                aria-label={item.label}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors duration-200',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'flex items-center justify-center rounded-full px-4 py-1 transition-all duration-200',
                    isActive && 'bg-primary/12'
                  )}
                >
                  <item.icon
                    className="w-[22px] h-[22px]"
                    strokeWidth={isActive ? 2.4 : 1.9}
                  />
                </span>
                <span className={cn('text-[11px] leading-none', isActive ? 'font-semibold' : 'font-medium')}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
