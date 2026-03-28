'use client';

import { cn } from '@/lib/utils/cn';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useEffect, useState } from 'react';

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
  duration?: number;
}

const variantConfig: Record<
  ToastVariant,
  { icon: typeof CheckCircle; accentClass: string; iconClass: string }
> = {
  success: {
    icon: CheckCircle,
    accentClass: 'border-l-success',
    iconClass: 'text-success',
  },
  error: {
    icon: XCircle,
    accentClass: 'border-l-destructive',
    iconClass: 'text-destructive',
  },
  warning: {
    icon: AlertTriangle,
    accentClass: 'border-l-warning',
    iconClass: 'text-warning',
  },
  info: {
    icon: Info,
    accentClass: 'border-l-primary',
    iconClass: 'text-primary',
  },
};

interface ToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

export function Toast({ toast, onDismiss }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const config = variantConfig[toast.variant];
  const Icon = config.icon;

  useEffect(() => {
    const enterTimer = setTimeout(() => setIsVisible(true), 10);

    const duration = toast.duration ?? 3000;
    const dismissTimer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, duration);

    return () => {
      clearTimeout(enterTimer);
      clearTimeout(dismissTimer);
    };
  }, [toast.id, toast.duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-xl',
        'min-w-[280px] max-w-[calc(100vw-2rem)]',
        'glass border border-white/[0.06] border-l-[3px]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'transition-all duration-300 ease-out',
        config.accentClass,
        isVisible && !isExiting
          ? 'opacity-100 translate-y-0 scale-100'
          : 'opacity-0 translate-y-3 scale-95'
      )}
      role="alert"
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0', config.iconClass)} />
      <p className="text-sm font-medium text-foreground flex-1">{toast.message}</p>
      <button
        onClick={handleDismiss}
        className="p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-colors flex-shrink-0 cursor-pointer"
        aria-label="닫기"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
