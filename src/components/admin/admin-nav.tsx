'use client';

import { cn } from '@/lib/utils/cn';
import { LayoutDashboard, Users, Building2 } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/users', label: '유저', icon: Users },
  { href: '/admin/clubs', label: '클럽', icon: Building2 },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 p-1 rounded-xl bg-muted mx-4 mb-4">
      {items.map((item) => {
        const isActive = item.href === '/admin'
          ? pathname === '/admin'
          : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-medium transition-all',
              isActive
                ? 'bg-surface-elevated text-primary shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <item.icon className="w-4 h-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
