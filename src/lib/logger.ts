import { createClient } from '@/lib/supabase/server';

export type LogLevel = 'error' | 'warn' | 'info' | 'debug';
export type LogCategory = 'auth' | 'match' | 'club' | 'draw' | 'media' | 'api' | 'client' | 'template' | 'recruitment' | 'profile' | 'system' | 'moderation';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  userId?: string | null;
  clubId?: string | null;
  matchId?: string | null;
  error?: Error | unknown;
  path?: string;
  method?: string;
  statusCode?: number;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Log to Supabase app_logs table.
 * Non-blocking: errors in logging itself are silently ignored
 * so they never break the actual application flow.
 */
async function writeLog(entry: LogEntry): Promise<void> {
  try {
    const supabase = await createClient();

    const errorObj = entry.error instanceof Error ? entry.error : null;

    await supabase.from('app_logs').insert({
      level: entry.level,
      category: entry.category,
      message: entry.message,
      user_id: entry.userId || null,
      club_id: entry.clubId || null,
      match_id: entry.matchId || null,
      error_name: errorObj?.name || (entry.error ? String(entry.error) : null),
      error_stack: errorObj?.stack || null,
      path: entry.path || null,
      method: entry.method || null,
      status_code: entry.statusCode || null,
      duration_ms: entry.durationMs || null,
      metadata: entry.metadata || {},
    });
  } catch {
    // Never let logging break the app
    if (process.env.NODE_ENV === 'development') {
      console.error('[logger] Failed to write log:', entry.message);
    }
  }
}

/** Log an error */
export function logError(category: LogCategory, message: string, opts?: Omit<LogEntry, 'level' | 'category' | 'message'>) {
  // Also console.error in dev for immediate visibility
  if (process.env.NODE_ENV === 'development') {
    console.error(`[${category}] ${message}`, opts?.error || '');
  }
  writeLog({ level: 'error', category, message, ...opts });
}

/** Log a warning */
export function logWarn(category: LogCategory, message: string, opts?: Omit<LogEntry, 'level' | 'category' | 'message'>) {
  writeLog({ level: 'warn', category, message, ...opts });
}

/** Log an info event (audit trail) */
export function logInfo(category: LogCategory, message: string, opts?: Omit<LogEntry, 'level' | 'category' | 'message'>) {
  writeLog({ level: 'info', category, message, ...opts });
}

/** Log a debug event (verbose, only in development) */
export function logDebug(category: LogCategory, message: string, opts?: Omit<LogEntry, 'level' | 'category' | 'message'>) {
  if (process.env.NODE_ENV === 'development') {
    writeLog({ level: 'debug', category, message, ...opts });
  }
}

/**
 * Client-side error reporting API.
 * Call from error.tsx boundaries via fetch('/api/logs', { method: 'POST', body: ... })
 */
export interface ClientLogPayload {
  level: LogLevel;
  category: LogCategory;
  message: string;
  errorName?: string;
  errorStack?: string;
  errorDigest?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}
