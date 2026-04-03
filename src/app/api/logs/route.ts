import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import type { ClientLogPayload } from '@/lib/logger';

/**
 * POST /api/logs — Client-side error reporting
 * Called from error.tsx boundaries to persist client errors
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const body: ClientLogPayload = await request.json();

    await supabase.from('app_logs').insert({
      level: body.level || 'error',
      category: body.category || 'client',
      message: body.message || 'Unknown client error',
      user_id: user?.id || null,
      error_name: body.errorName || null,
      error_stack: body.errorStack || null,
      path: body.path || null,
      metadata: {
        ...body.metadata,
        digest: body.errorDigest,
        source: 'client',
      },
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
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 });

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
