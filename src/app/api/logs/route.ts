import { createClient } from '@/lib/supabase/server';
import { isAdmin } from '@/lib/utils/admin';
import { NextResponse } from 'next/server';
import type { ClientLogPayload } from '@/lib/logger';

const LOG_LEVELS = ['error', 'warn', 'info', 'debug'] as const;
const LOG_CATEGORIES = [
  'auth', 'match', 'club', 'draw', 'media', 'api', 'client',
  'template', 'recruitment', 'profile', 'system', 'moderation',
] as const;

function clampStr(v: unknown, max: number): string | null {
  if (typeof v !== 'string' || v.length === 0) return null;
  return v.slice(0, max);
}

/**
 * POST /api/logs — Client-side error reporting
 * Called from error.tsx boundaries to persist client errors.
 * 입력값을 검증·길이 제한하여 로그 플러딩/주입을 방지한다.
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const raw = await request.text();
    if (raw.length > 20_000) {
      return NextResponse.json({ ok: false }, { status: 413 });
    }
    const body = JSON.parse(raw) as ClientLogPayload;

    const level = LOG_LEVELS.includes(body.level as typeof LOG_LEVELS[number]) ? body.level : 'error';
    const category = LOG_CATEGORIES.includes(body.category as typeof LOG_CATEGORIES[number]) ? body.category : 'client';

    // metadata는 객체일 때만, 크기 제한
    let metadata: Record<string, unknown> = { source: 'client' };
    if (body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)) {
      const serialized = JSON.stringify(body.metadata).slice(0, 4000);
      try { metadata = { ...JSON.parse(serialized), source: 'client' }; } catch { /* keep default */ }
    }
    if (body.errorDigest) metadata.digest = clampStr(body.errorDigest, 200);

    await supabase.from('app_logs').insert({
      level,
      category,
      message: clampStr(body.message, 2000) || 'Unknown client error',
      user_id: user?.id || null,
      error_name: clampStr(body.errorName, 500),
      error_stack: clampStr(body.errorStack, 8000),
      path: clampStr(body.path, 1000),
      metadata,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

/**
 * GET /api/logs — Query logs (for monitoring sessions)
 * ?level=error&category=match&limit=50&since=2026-04-01
 */
export async function GET(request: Request) {
  // 로그에는 다른 사용자/시스템 정보가 포함되므로 관리자만 조회 가능
  if (!(await isAdmin())) {
    return NextResponse.json({ error: '권한이 없습니다' }, { status: 403 });
  }

  const supabase = await createClient();

  const { searchParams } = new URL(request.url);
  const level = searchParams.get('level');
  const category = searchParams.get('category');
  const since = searchParams.get('since');
  const limit = Math.min(Number(searchParams.get('limit') || 50), 200);

  let query = supabase
    .from('app_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (level) query = query.eq('level', level);
  if (category) query = query.eq('category', category);
  if (since) query = query.gte('created_at', since);

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: data, count: data?.length || 0 });
}
