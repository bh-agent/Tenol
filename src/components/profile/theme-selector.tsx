'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/lib/theme/theme-store';
import type { ThemePreference } from '@/lib/theme/theme';
import { cn } from '@/lib/utils/cn';

const OPTIONS: Array<{ value: ThemePreference; label: string; Icon: typeof Sun }> = [
  { value: 'system', label: '시스템', Icon: Monitor },
  { value: 'light', label: '라이트', Icon: Sun },
  { value: 'dark', label: '다크', Icon: Moon },
];

/** 프로필 설정 섹션의 '화면 테마' 행 — 시스템 / 라이트 / 다크 세그먼트 */
export function ThemeSelector() {
  const { preference, setPreference } = useTheme();

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Sun className="w-4 h-4 text-muted-foreground flex-shrink-0" aria-hidden />
      <span className="flex-1 text-sm text-foreground">화면 테마</span>
      <div
        role="radiogroup"
        aria-label="화면 테마"
        className="flex p-0.5 rounded-lg bg-muted border border-border"
      >
        {OPTIONS.map(({ value, label, Icon }) => {
          const active = preference === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setPreference(value)}
              className={cn(
                'flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium transition-colors cursor-pointer',
                active
                  ? 'bg-surface text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
