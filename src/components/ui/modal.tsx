'use client';

import { cn } from '@/lib/utils/cn';
import { X } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}

export function Modal({ isOpen, onClose, title, children, className }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
      // Trigger enter animation on next frame
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      document.body.style.overflow = '';
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ESC 키로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // 접근성: 열릴 때 포커스를 다이얼로그로 이동·가두고, 닫힐 때 트리거로 복원
  useEffect(() => {
    if (!isOpen || !mounted) return;
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current;
    requestAnimationFrame(() => dialog?.focus());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialog) return;
      const f = dialog.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (f.length === 0) { e.preventDefault(); dialog.focus(); return; }
      const first = f[0], last = f[f.length - 1], active = document.activeElement;
      if (e.shiftKey && (active === first || active === dialog)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      prevFocusRef.current?.focus?.();
    };
  }, [isOpen, mounted]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50">
      {/* Backdrop with blur */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Modal Container — --keyboard-height는 KeyboardScrollFix가 네이티브 키보드 표시 시 설정.
          시트 전체를 키보드 위로 들어올려 입력창이 가려지지 않게 한다. */}
      <div
        className="fixed inset-0 flex items-end sm:items-center sm:justify-center pointer-events-none"
        style={{ paddingBottom: 'var(--keyboard-height, 0px)' }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          style={{ maxHeight: 'calc(95vh - var(--keyboard-height, 0px))', outline: 'none' }}
          className={cn(
            'pointer-events-auto relative z-50 w-full flex flex-col',
            // Glass effect
            'glass border-t border-white/[0.06]',
            // Mobile: bottom-sheet style
            'rounded-t-2xl',
            // Desktop: centered modal
            'sm:max-w-md sm:rounded-2xl sm:max-h-[85vh] sm:border sm:border-white/[0.06]',
            // Animation
            'transition-all duration-300 ease-out',
            visible
              ? 'translate-y-0 opacity-100'
              : 'translate-y-8 sm:translate-y-4 opacity-0',
            className
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
            {title ? (
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            ) : (
              <div />
            )}
            <button
              onClick={onClose}
              aria-label="닫기"
              className="p-2.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overscroll-contain p-5">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
