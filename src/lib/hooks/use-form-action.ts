'use client';

import { useCallback, useState, useTransition } from 'react';
import { useToast } from '@/components/ui/toast-provider';

interface UseFormActionOptions<T> {
  action: (...args: T[]) => Promise<void>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  successMessage?: string;
  errorMessage?: string;
}

interface UseFormActionReturn {
  execute: (...args: any[]) => Promise<void>;
  isPending: boolean;
  error: Error | null;
}

export function useFormAction<T = any>({
  action,
  onSuccess,
  onError,
  successMessage,
  errorMessage,
}: UseFormActionOptions<T>): UseFormActionReturn {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<Error | null>(null);
  const toast = useToast();

  const execute = useCallback(
    async (...args: any[]) => {
      setError(null);

      startTransition(async () => {
        try {
          await action(...args);
          if (successMessage) {
            toast.success(successMessage);
          }
          onSuccess?.();
        } catch (err) {
          const error = err instanceof Error ? err : new Error('알 수 없는 오류가 발생했습니다');
          setError(error);
          toast.error(errorMessage ?? error.message);
          onError?.(error);
        }
      });
    },
    [action, onSuccess, onError, successMessage, errorMessage, toast],
  );

  return { execute, isPending, error };
}
