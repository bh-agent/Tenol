'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Toast, type ToastData, type ToastVariant } from './toast';

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let toastIdCounter = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message: string, variant: ToastVariant = 'info') => {
    const id = `toast-${++toastIdCounter}`;
    setToasts((prev) => [...prev, { id, message, variant }]);
  }, []);

  const success = useCallback((msg: string) => addToast(msg, 'success'), [addToast]);
  const error = useCallback((msg: string) => addToast(msg, 'error'), [addToast]);
  const warning = useCallback((msg: string) => addToast(msg, 'warning'), [addToast]);
  const info = useCallback((msg: string) => addToast(msg, 'info'), [addToast]);
  // value를 메모해 토스트가 뜰 때마다 useToast 구독 컴포넌트가 전부 리렌더되는 것 방지
  const value = useMemo<ToastContextValue>(
    () => ({ toast: addToast, success, error, warning, info }),
    [addToast, success, error, warning, info],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Toast container - bottom center, mobile-friendly */}
      <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[100] flex flex-col-reverse items-center gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a <ToastProvider>');
  }
  return ctx;
}
