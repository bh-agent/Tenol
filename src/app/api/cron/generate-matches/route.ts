import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { getNextMatchDate, resolveTitle, type TitleFormat } from '@/lib/utils/next-match-date';
import { logError, logInfo } from '@/lib/logger';

// 반복 경기 자동 생성 — Vercel Cron이 매일 호출 (vercel.json 참고)
// 활성 템플릿을 순회하며, 다음 경기일이 LEAD_DAYS 이내로 다가오면 경기를 자동 생성한다.
// last_created_date를 갱신하므로 같은 회차를 두 번 만들지 않는다(멱등).

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const LEAD_DAYS = 7; // 경기일 7일 전부터 미리 생성 (회원 신청 여유)

function todayPlusDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  // 1. 인증 — Vercel Cron은 CRON_SECRET이 설정되면 Authorization 헤더를 자동 첨부한다.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET 미설정' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: '인증 실패' }, { status: 401 });
  }

  // 2. service_role 클라이언트 (RLS 우회 — cron에는 로그인 세션이 없음)
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: '서버 설정 오류' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const cutoff = todayPlusDays(LEAD_DAYS);

  // 3. 활성 템플릿 조회
  const { data: templates, error: templatesError } = await supabase
    .from('match_templates')
    .select('*')
    .eq('is_active', true);

  if (templatesError) {
    logError('template', 'Cron: 템플릿 조회 실패', { error: templatesError });
    return NextResponse.json({ error: '템플릿 조회 실패' }, { status: 500 });
  }

  let created = 0;
  const createdMatchIds: string[] = [];

  for (const template of templates ?? []) {
    try {
      const matchDate = getNextMatchDate(
        template.day_of_week,
        template.frequency_weeks,
        template.last_created_date,
      );

      // 아직 생성 시점이 아니면 건너뜀
      if (matchDate > cutoff) continue;
      // 이미 이 회차를 생성했으면 건너뜀 (멱등 안전장치)
      if (template.last_created_date === matchDate) continue;

      // with_round 회차 계산
      const titleFormat = (template.title_format || 'with_date') as TitleFormat;
      let roundNumber = 1;
      if (titleFormat === 'with_round') {
        const dateObj = new Date(matchDate + 'T00:00:00');
        const monthStart = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-01`;
        const monthEnd = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 2).padStart(2, '0')}-01`;
        const { count } = await supabase
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .eq('club_id', template.club_id)
          .gte('match_date', monthStart)
          .lt('match_date', monthEnd)
          .ilike('title', `${template.name}%`);
        roundNumber = (count || 0) + 1;
      }

      const title = resolveTitle(template.name, matchDate, titleFormat, roundNumber);

      const { data: match, error: matchError } = await supabase
        .from('matches')
        .insert({
          club_id: template.club_id,
          title,
          description: template.description,
          location: template.location,
          match_date: matchDate,
          start_time: template.start_time,
          end_time: template.end_time,
          court_count: template.court_count,
          max_participants: template.max_participants,
          allow_guests: template.allow_guests,
          format: template.format,
          created_by: template.created_by,
        })
        .select('id')
        .single();

      if (matchError || !match) {
        logError('template', 'Cron: 경기 생성 실패', { clubId: template.club_id, error: matchError });
        continue;
      }

      // 템플릿 작성자를 첫 참가자로 등록 (수동 생성과 동일)
      await supabase.from('match_participants').insert({
        match_id: match.id,
        user_id: template.created_by,
        participant_type: 'member',
        status: 'confirmed',
      });

      await supabase
        .from('match_templates')
        .update({ last_created_date: matchDate, updated_at: new Date().toISOString() })
        .eq('id', template.id);

      created += 1;
      createdMatchIds.push(match.id);
    } catch (err) {
      logError('template', 'Cron: 템플릿 처리 중 오류', {
        metadata: { templateId: template.id },
        error: err as Error,
      });
    }
  }

  logInfo('template', 'Cron: 반복 경기 자동 생성 완료', {
    metadata: { created, total: templates?.length ?? 0 },
  });

  return NextResponse.json({ ok: true, created, matchIds: createdMatchIds });
}
