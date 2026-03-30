'use client';

import { cn } from '@/lib/utils/cn';
import { X } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
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

      {/* Modal Container */}
      <div className="fixed inset-0 flex items-end sm:items-center sm:justify-center pointer-events-none">
        <div
          className={cn(
            'pointer-events-auto relative z-50 w-full flex flex-col',
            // Glass effect
            'glass border-t border-white/[0.06]',
            // Mobile: bottom-sheet style
            'max-h-[95vh] rounded-t-2xl',
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
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all duration-200 cursor-pointer"
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
