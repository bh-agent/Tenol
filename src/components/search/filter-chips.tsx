'use client';

import { cn } from '@/lib/utils/cn';
import { useRef } from 'react';

interface FilterChip {
  key: string;
  label: string;
}

interface FilterChipsProps {
  chips: FilterChip[];
  selected: string;
  onChange: (key: string) => void;
  className?: string;
}

export function FilterChips({ chips, selected, onChange, className }: FilterChipsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4',
        className
      )}
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          onClick={() => onChange(chip.key)}
          className={cn(
            'flex-shrink-0 px-3.5 py-1.5 min-h-[44px] min-w-[44px] rounded-full text-sm font-medium transition-all whitespace-nowrap',
            selected === chip.key
              ? 'bg-primary text-black shadow-[0_0_12px_rgba(0,230,118,0.25)]'
              : 'bg-surface-elevated text-muted-foreground hover:bg-surface-hover hover:text-foreground'
          )}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
