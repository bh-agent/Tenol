'use client';

import { cn } from '@/lib/utils/cn';
import { useEffect, useRef } from 'react';

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
  const selectedRef = useRef<HTMLButtonElement>(null);

  // 선택된 칩이 보이도록 자동 스크롤
  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const chip = selectedRef.current;
      const chipLeft = chip.offsetLeft;
      const chipWidth = chip.offsetWidth;
      const containerWidth = container.offsetWidth;
      const scrollLeft = container.scrollLeft;

      // 칩이 보이는 영역 밖이면 스크롤
      if (chipLeft < scrollLeft + 16) {
        container.scrollTo({ left: chipLeft - 16, behavior: 'smooth' });
      } else if (chipLeft + chipWidth > scrollLeft + containerWidth - 16) {
        container.scrollTo({ left: chipLeft + chipWidth - containerWidth + 16, behavior: 'smooth' });
      }
    }
  }, [selected]);

  return (
    <div
      ref={scrollRef}
      className={cn(
        'flex gap-2 overflow-x-auto scrollbar-hide pb-1',
        '-mx-4 px-4',
        // touch-action으로 수평 스크롤 강제 허용
        'touch-pan-x',
        className
      )}
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      {chips.map((chip) => (
        <button
          key={chip.key}
          ref={selected === chip.key ? selectedRef : undefined}
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
