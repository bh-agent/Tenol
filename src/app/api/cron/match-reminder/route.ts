import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { kstToday } from '@/lib/utils/next-match-date';
import { logError, logInfo } from '@/lib/logger';
import { notifyUsers } from '@/lib/server/notify';

// 경기 당일 아침 리마인더 — Vercel Cron이 매일 01:00 UTC(=10:00 KST) 호출.
// 오늘(KST) 예정된 경기의 확정 참가자에게 "오늘 경기가 있어요" 알림을 보낸다.
// 멱등: 같은 경기에 match_reminder 알림이 이미 존재하면 건너뛴다(재실행 안전).

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const d = kstToday();
  const todayKst = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // 오늘 예정된 경기
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, club_id, title, location, start_time')
    .eq('match_date', todayKst)
    .eq('status', 'upcoming');

  if (error) {
    logError('match', 'Cron: 리마인더 대상 조회 실패', { error });
    return NextResponse.json({ error: '조회 실패' }, { status: 500 });
  }

  let notified = 0;
  for (const match of matches || []) {
    try {
      // 멱등 가드: 이 경기로 리마인더를 이미 보냈으면 건너뜀
      const { count: already } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('type', 'match_reminder')
        .eq('data->>match_id', match.id);
      if (already && already > 0) continue;

      const { data: parts } = await supabase
        .from('match_participants')
        .select('user_id')
        .eq('match_id', match.id)
        .eq('status', 'confirmed');
      const targets = (parts || [])
        .map((p: { user_id: string | null }) => p.user_id)
        .filter((id: string | null): id is string => !!id);
      if (targets.length === 0) continue;

      const time = match.start_time ? String(match.start_time).slice(0, 5) : '';
      const where = match.location ? ` · ${match.location}` : '';
      await notifyUsers(
        targets,
        'match_reminder',
        '오늘 경기가 있어요 ⏰',
        `${match.title}${time ? ` · ${time}` : ''}${where}`,
        { match_id: match.id, club_id: match.club_id },
      );
      notified += targets.length;
    } catch (err) {
      logError('match', 'Cron: 리마인더 발송 실패', { matchId: match.id, error: err as Error });
    }
  }

  logInfo('match', 'Cron: 경기 리마인더 발송 완료', {
    metadata: { matches: matches?.length ?? 0, notified },
  });
  return NextResponse.json({ ok: true, matches: matches?.length ?? 0, notified });
}
