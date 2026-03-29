'use client';

import { cn } from '@/lib/utils/cn';
import { Home, Compass, Users, Trophy, User } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/feed', label: '홈', icon: Home },
  { href: '/clubs/explore', label: '탐색', icon: Compass },
  { href: '/clubs', label: '클럽', icon: Users },
  { href: '/my-matches', label: '경기', icon: Trophy },
  { href: '/profile', label: '프로필', icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),8px)]">
      <div className="max-w-lg mx-auto glass border border-border/50 rounded-2xl">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            let isActive: boolean;
            if (item.href === '/clubs') {
              isActive = pathname === '/clubs' || (pathname.startsWith('/clubs/') && !pathname.startsWith('/clubs/explore'));
            } else if (item.href === '/feed') {
              isActive = pathname === '/feed' || pathname.startsWith('/feed/');
            } else if (item.href === '/clubs/explore') {
              isActive = pathname.startsWith('/clubs/explore');
            } else {
              isActive = pathname.startsWith(item.href);
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 w-16 h-full relative transition-all duration-200',
                  isActive
                    ? 'text-primary'
                    : 'text-muted-foreground'
                )}
              >
                <item.icon
                  className={cn(
                    'w-5 h-5 transition-transform duration-200',
                    isActive && 'scale-110'
                  )}
                  strokeWidth={2}
                />
                <span className="text-[10px] font-medium">{item.label}</span>
                {isActive && (
                  <span className="absolute bottom-2 w-1 h-1 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
