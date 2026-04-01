'use client';

import { REGIONS, getSigunguList, formatRegion, parseRegion } from '@/lib/constants/regions';
import { MapPin, X, ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils/cn';

interface RegionPickerProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** form의 hidden input name */
  name?: string;
}

export function RegionPicker({
  value,
  onChange,
  label = '활동 지역',
  placeholder = '지역을 선택해주세요',
  name,
}: RegionPickerProps) {
  const [open, setOpen] = useState(false);
  const [selectedSido, setSelectedSido] = useState<string | null>(null);

  // 열 때 현재 값 기준으로 시/도 선택
  useEffect(() => {
    if (open) {
      const { sido } = parseRegion(value);
      setSelectedSido(sido);
    }
  }, [open, value]);

  const handleSelect = (sido: string, sigungu: string | null) => {
    onChange(formatRegion(sido, sigungu));
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  const currentSigunguList = selectedSido ? getSigunguList(selectedSido) : [];

  return (
    <>
      <div>
        {label && (
          <label className="block text-sm font-medium text-foreground mb-1.5">
            {label}
          </label>
        )}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full h-11 rounded-xl border border-border bg-surface-elevated px-3 text-sm text-left flex items-center gap-2 hover:border-primary/30 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
        >
          <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className={cn('flex-1 truncate', value ? 'text-foreground' : 'text-subtle')}>
            {value || placeholder}
          </span>
          {value && (
            <span
              onClick={handleClear}
              className="p-0.5 rounded-full hover:bg-surface-hover transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </span>
          )}
        </button>
        {name && <input type="hidden" name={name} value={value} />}
      </div>

      {/* Bottom Sheet */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-surface-elevated rounded-t-2xl border-t border-border shadow-xl animate-slide-up safe-bottom max-h-[70vh] flex flex-col">
            {/* Handle */}
            <div className="w-10 h-1 rounded-full bg-muted mx-auto mt-3 mb-1 shrink-0" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <h3 className="font-semibold text-foreground">지역 선택</h3>
              <button
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-full hover:bg-surface-hover transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            {/* Two-column picker */}
            <div className="flex flex-1 min-h-0">
              {/* 시/도 (왼쪽) */}
              <div className="w-[40%] border-r border-border overflow-y-auto">
                {REGIONS.map((r) => (
                  <button
                    key={r.short}
                    onClick={() => {
                      setSelectedSido(r.short);
                      // 세종처럼 시/군/구 없는 경우 바로 선택
                      if (r.sigungu.length === 0) {
                        handleSelect(r.short, null);
                      }
                    }}
                    className={cn(
                      'w-full text-left px-4 py-3 text-sm transition-colors',
                      selectedSido === r.short
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-foreground hover:bg-surface-hover'
                    )}
                  >
                    <span className="flex items-center justify-between">
                      {r.short}
                      {r.sigungu.length > 0 && (
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                    </span>
                  </button>
                ))}
              </div>

              {/* 시/군/구 (오른쪽) */}
              <div className="flex-1 overflow-y-auto">
                {selectedSido && currentSigunguList.length > 0 ? (
                  <>
                    {/* 전체 옵션 */}
                    <button
                      onClick={() => handleSelect(selectedSido, null)}
                      className={cn(
                        'w-full text-left px-4 py-3 text-sm transition-colors font-medium',
                        value === selectedSido
                          ? 'bg-primary/10 text-primary'
                          : 'text-primary/80 hover:bg-surface-hover'
                      )}
                    >
                      {selectedSido} 전체
                    </button>
                    {currentSigunguList.map((gu) => {
                      const fullValue = formatRegion(selectedSido, gu);
                      return (
                        <button
                          key={gu}
                          onClick={() => handleSelect(selectedSido, gu)}
                          className={cn(
                            'w-full text-left px-4 py-3 text-sm transition-colors',
                            value === fullValue
                              ? 'bg-primary/10 text-primary font-semibold'
                              : 'text-foreground hover:bg-surface-hover'
                          )}
                        >
                          {gu}
                        </button>
                      );
                    })}
                  </>
                ) : selectedSido ? (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    선택 완료
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                    시/도를 선택하세요
                  </div>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
