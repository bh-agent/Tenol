'use server';

import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/utils/check-permission';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createRecruitmentSchema, uuidSchema } from '@/lib/validations';

export async function createRecruitmentPost(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const clubId = formData.get('club_id') as string;

  // Check club admin permission
  await requirePermission(clubId, 'member.manage');

  const neededCountRaw = formData.get('needed_count');
  const ntrpMinRaw = formData.get('ntrp_min');
  const ntrpMaxRaw = formData.get('ntrp_max');
  const maleSlotsRaw = formData.get('male_slots');
  const femaleSlotsRaw = formData.get('female_slots');
  const anySlotsRaw = formData.get('any_slots');

  const validated = createRecruitmentSchema.parse({
    club_id: clubId,
    type: formData.get('type'),
    title: formData.get('title'),
    description: formData.get('description') || undefined,
    match_id: formData.get('match_id') || undefined,
    match_date: formData.get('match_date') || undefined,
    location: formData.get('location') || undefined,
    needed_count: neededCountRaw ? Number(neededCountRaw) : undefined,
    male_slots: maleSlotsRaw ? Number(maleSlotsRaw) : undefined,
    female_slots: femaleSlotsRaw ? Number(femaleSlotsRaw) : undefined,
    any_slots: anySlotsRaw ? Number(anySlotsRaw) : undefined,
    ntrp_min: ntrpMinRaw ? Number(ntrpMinRaw) : undefined,
    ntrp_max: ntrpMaxRaw ? Number(ntrpMaxRaw) : undefined,
  });

  const { error } = await supabase.from('recruitment_posts').insert({
    club_id: validated.club_id,
    created_by: user.id,
    type: validated.type,
    title: validated.title,
    description: validated.description || null,
    match_id: validated.match_id || null,
    match_date: validated.match_date || null,
    location: validated.location || null,
    needed_count: validated.needed_count || null,
    male_slots: validated.male_slots ?? null,
    female_slots: validated.female_slots ?? null,
    any_slots: validated.any_slots ?? null,
    ntrp_min: validated.ntrp_min || null,
    ntrp_max: validated.ntrp_max || null,
  });

  if (error) throw new Error('모집글 작성에 실패했습니다');

  revalidatePath(`/clubs/${clubId}`);
  revalidatePath('/recruit');
  redirect(`/clubs/${clubId}`);
}

export async function closeRecruitmentPost(postId: string) {
  const validPostId = uuidSchema.parse(postId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: post } = await supabase
    .from('recruitment_posts')
    .select('id, created_by, club_id')
    .eq('id', validPostId)
    .single();

  if (!post) throw new Error('모집글을 찾을 수 없습니다');
  if (post.created_by !== user.id) throw new Error('권한이 없습니다');

  const { error } = await supabase
    .from('recruitment_posts')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', validPostId);

  if (error) throw new Error('모집 마감에 실패했습니다');

  revalidatePath(`/clubs/${post.club_id}`);
  revalidatePath('/recruit');
}

export async function deleteRecruitmentPost(postId: string) {
  const validPostId = uuidSchema.parse(postId);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('인증이 필요합니다');

  const { data: post } = await supabase
    .from('recruitment_posts')
    .select('id, created_by, club_id')
    .eq('id', validPostId)
    .single();

  if (!post) throw new Error('모집글을 찾을 수 없습니다');
  if (post.created_by !== user.id) throw new Error('권한이 없습니다');

  const { error } = await supabase
    .from('recruitment_posts')
    .delete()
    .eq('id', validPostId);

  if (error) throw new Error('모집글 삭제에 실패했습니다');

  revalidatePath(`/clubs/${post.club_id}`);
  revalidatePath('/recruit');
}
