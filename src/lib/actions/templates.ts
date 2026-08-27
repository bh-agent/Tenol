'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/utils/check-permission';
import { logError, logInfo } from '@/lib/logger';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createMatchTemplateSchema, updateMatchTemplateSchema, uuidSchema } from '@/lib/validations';
import { getNextMatchDate, resolveTitle } from '@/lib/utils/next-match-date';
import type { TitleFormat } from '@/lib/utils/next-match-date';

export async function createTemplate(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const clubId = formData.get('club_id') as string;
  await requirePermission(clubId, 'match.create');

  const validated = createMatchTemplateSchema.parse({
    club_id: clubId,
    name: formData.get('name'),
    title_format: formData.get('title_format') || 'with_date',
    description: formData.get('description') || undefined,
    location: formData.get('location') || undefined,
    start_time: formData.get('start_time') || undefined,
    end_time: formData.get('end_time') || undefined,
    court_count: Number(formData.get('court_count') || 1),
    max_participants: formData.get('max_participants') ? Number(formData.get('max_participants')) : undefined,
    allow_guests: formData.get('allow_guests') === 'true',
    format: formData.get('format') || 'doubles',
    day_of_week: Number(formData.get('day_of_week')),
    frequency_weeks: Number(formData.get('frequency_weeks') || 1),
  });

  const { error } = await supabase.from('match_templates').insert({
    club_id: validated.club_id,
    name: validated.name,
    title_pattern: validated.name, // backward compat
    title_format: validated.title_format,
    description: validated.description || null,
    location: validated.location || null,
    start_time: validated.start_time || null,
    end_time: validated.end_time || null,
    court_count: validated.court_count,
    max_participants: validated.max_participants ?? null,
    allow_guests: validated.allow_guests,
    format: validated.format,
    day_of_week: validated.day_of_week,
    frequency_weeks: validated.frequency_weeks,
    created_by: user.id,
  });

  if (error) {
    logError('template', 'Failed to create template', { userId: user.id, clubId, error });
    throw new Error('템플릿 생성에 실패했습니다');
  }

  logInfo('template', 'Template created', { userId: user.id, clubId, metadata: { name: validated.name } });

  revalidatePath(`/clubs/${clubId}/templates`);
  redirect(`/clubs/${clubId}/templates`);
}

export async function updateTemplate(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const templateId = formData.get('id') as string;

  // Fetch template to get club_id
  const { data: existing } = await supabase
    .from('match_templates')
    .select('club_id')
    .eq('id', templateId)
    .maybeSingle();
  if (!existing) throw new Error('템플릿을 찾을 수 없습니다');

  await requirePermission(existing.club_id, 'match.create');

  const validated = updateMatchTemplateSchema.parse({
    id: templateId,
    name: formData.get('name'),
    title_format: formData.get('title_format') || 'with_date',
    description: formData.get('description') || undefined,
    location: formData.get('location') || undefined,
    start_time: formData.get('start_time') || undefined,
    end_time: formData.get('end_time') || undefined,
    court_count: Number(formData.get('court_count') || 1),
    max_participants: formData.get('max_participants') ? Number(formData.get('max_participants')) : undefined,
    allow_guests: formData.get('allow_guests') === 'true',
    format: formData.get('format') || 'doubles',
    day_of_week: Number(formData.get('day_of_week')),
    frequency_weeks: Number(formData.get('frequency_weeks') || 1),
  });

  const { error } = await supabase
    .from('match_templates')
    .update({
      name: validated.name,
      title_pattern: validated.name,
      title_format: validated.title_format,
      description: validated.description || null,
      location: validated.location || null,
      start_time: validated.start_time || null,
      end_time: validated.end_time || null,
      court_count: validated.court_count,
      max_participants: validated.max_participants ?? null,
      allow_guests: validated.allow_guests,
      format: validated.format,
      day_of_week: validated.day_of_week,
      frequency_weeks: validated.frequency_weeks,
      updated_at: new Date().toISOString(),
    })
    .eq('id', validated.id);

  if (error) {
    logError('template', 'Failed to update template', { userId: user.id, clubId: existing.club_id, error });
    throw new Error('템플릿 수정에 실패했습니다');
  }

  logInfo('template', 'Template updated', { userId: user.id, clubId: existing.club_id, metadata: { name: validated.name } });

  revalidatePath(`/clubs/${existing.club_id}/templates`);
  redirect(`/clubs/${existing.club_id}/templates`);
}

export async function deleteTemplate(templateId: string) {
  const validId = uuidSchema.parse(templateId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: template } = await supabase
    .from('match_templates')
    .select('id, club_id')
    .eq('id', validId)
    .maybeSingle();

  if (!template) throw new Error('템플릿을 찾을 수 없습니다');

  // create/update와 동일한 권한 검사 (무음 실패·권한 모델 불일치 방지)
  const { requirePermission } = await import('@/lib/utils/check-permission');
  await requirePermission(template.club_id, 'match.create');

  const { error } = await supabase
    .from('match_templates')
    .delete()
    .eq('id', validId);

  if (error) {
    logError('template', 'Failed to delete template', { userId: user.id, clubId: template.club_id, error });
    throw new Error('템플릿 삭제에 실패했습니다');
  }

  logInfo('template', 'Template deleted', { userId: user.id, clubId: template.club_id, metadata: { templateId: validId } });

  revalidatePath(`/clubs/${template.club_id}/templates`);
}

export async function createMatchFromTemplate(templateId: string) {
  const validId = uuidSchema.parse(templateId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: template } = await supabase
    .from('match_templates')
    .select('*')
    .eq('id', validId)
    .maybeSingle();

  if (!template) throw new Error('템플릿을 찾을 수 없습니다');

  await requirePermission(template.club_id, 'match.create');

  const matchDate = getNextMatchDate(
    template.day_of_week,
    template.frequency_weeks,
    template.last_created_date
  );

  // Calculate round number for with_round format
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
      created_by: user.id,
    })
    .select('id')
    .single();

  if (matchError || !match) {
    logError('template', 'Failed to create match from template', { userId: user.id, clubId: template.club_id, error: matchError });
    throw new Error('경기 생성에 실패했습니다');
  }

  await supabase.from('match_participants').insert({
    match_id: match.id,
    user_id: user.id,
    participant_type: 'member',
    status: 'confirmed',
  });

  await supabase
    .from('match_templates')
    .update({ last_created_date: matchDate, updated_at: new Date().toISOString() })
    .eq('id', validId);

  logInfo('template', 'Match created from template', { userId: user.id, matchId: match.id, clubId: template.club_id });

  revalidatePath(`/clubs/${template.club_id}`);
  revalidatePath(`/clubs/${template.club_id}/templates`);
  redirect(`/clubs/${template.club_id}/matches/${match.id}`);
}
