'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/utils/check-permission';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createMatchTemplateSchema, uuidSchema } from '@/lib/validations';
import { getNextMatchDate, resolveTitle } from '@/lib/utils/next-match-date';

export async function createTemplate(formData: FormData) {
  // Auth check
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const clubId = formData.get('club_id') as string;
  await requirePermission(clubId, 'match.create');

  // Parse form data - numbers need conversion
  const validated = createMatchTemplateSchema.parse({
    club_id: clubId,
    name: formData.get('name'),
    title_pattern: formData.get('title_pattern'),
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
    title_pattern: validated.title_pattern,
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

  if (error) throw new Error('템플릿 생성에 실패했습니다');

  revalidatePath(`/clubs/${clubId}/templates`);
  redirect(`/clubs/${clubId}/templates`);
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

  const { error } = await supabase
    .from('match_templates')
    .delete()
    .eq('id', validId);

  if (error) throw new Error('템플릿 삭제에 실패했습니다');

  revalidatePath(`/clubs/${template.club_id}/templates`);
}

export async function createMatchFromTemplate(templateId: string) {
  const validId = uuidSchema.parse(templateId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  // Fetch template
  const { data: template } = await supabase
    .from('match_templates')
    .select('*')
    .eq('id', validId)
    .maybeSingle();

  if (!template) throw new Error('템플릿을 찾을 수 없습니다');

  await requirePermission(template.club_id, 'match.create');

  // Calculate next date
  const matchDate = getNextMatchDate(
    template.day_of_week,
    template.frequency_weeks,
    template.last_created_date
  );

  // Resolve title
  const title = resolveTitle(template.title_pattern, matchDate);

  // Create the match (same logic as createMatch in matches.ts)
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

  if (matchError || !match) throw new Error('경기 생성에 실패했습니다');

  // Auto-add creator as participant
  await supabase.from('match_participants').insert({
    match_id: match.id,
    user_id: user.id,
    participant_type: 'member',
    status: 'confirmed',
  });

  // Update last_created_date on template
  await supabase
    .from('match_templates')
    .update({ last_created_date: matchDate, updated_at: new Date().toISOString() })
    .eq('id', validId);

  revalidatePath(`/clubs/${template.club_id}`);
  revalidatePath(`/clubs/${template.club_id}/templates`);
  redirect(`/clubs/${template.club_id}/matches/${match.id}`);
}
