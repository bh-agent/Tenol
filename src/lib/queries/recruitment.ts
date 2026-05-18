import { createClient } from '@/lib/supabase/server';
import type { RecruitmentType, RecruitmentPost } from '@/types';

/** 경기 날짜가 지난 모집글을 자동 마감 처리 */
async function closeExpiredPosts(supabase: any) {
  const today = new Date().toISOString().split('T')[0];
  await supabase
    .from('recruitment_posts')
    .update({ status: 'closed' })
    .eq('status', 'open')
    .not('match_date', 'is', null)
    .lt('match_date', today);
}

/** 현재 사용자가 차단한 사용자 ID 목록 (Apple Guideline 1.2) */
async function getBlockedIds(supabase: any): Promise<string[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id')
    .eq('blocker_id', user.id);
  return (data ?? []).map((row: { blocked_id: string }) => row.blocked_id);
}

export async function getRecruitmentPosts(
  type?: RecruitmentType,
  limit = 20
): Promise<RecruitmentPost[]> {
  const supabase = await createClient();
  await closeExpiredPosts(supabase);
  const blockedIds = await getBlockedIds(supabase);

  let query = supabase
    .from('recruitment_posts')
    .select(`
      id, club_id, match_id, created_by, type, title, description,
      match_date, location, needed_count, male_slots, female_slots, any_slots,
      ntrp_min, ntrp_max, status, created_at,
      clubs:club_id (name, logo_url, region),
      profiles:created_by (display_name, avatar_url)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq('type', type);
  }

  if (blockedIds.length > 0) {
    query = query.not('created_by', 'in', `(${blockedIds.join(',')})`);
  }

  const { data } = await query;
  return (data as unknown as RecruitmentPost[]) || [];
}

export async function searchRecruitmentPosts(
  searchQuery?: string,
  type?: RecruitmentType,
  limit = 20
): Promise<RecruitmentPost[]> {
  const supabase = await createClient();
  await closeExpiredPosts(supabase);
  const blockedIds = await getBlockedIds(supabase);

  let query = supabase
    .from('recruitment_posts')
    .select(`
      id, club_id, match_id, created_by, type, title, description,
      match_date, location, needed_count, male_slots, female_slots, any_slots,
      ntrp_min, ntrp_max, status, created_at,
      clubs:club_id (name, logo_url, region),
      profiles:created_by (display_name, avatar_url)
    `)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (type) {
    query = query.eq('type', type);
  }

  if (searchQuery && searchQuery.trim()) {
    query = query.ilike('title', `%${searchQuery.trim()}%`);
  }

  if (blockedIds.length > 0) {
    query = query.not('created_by', 'in', `(${blockedIds.join(',')})`);
  }

  const { data } = await query;
  return (data as unknown as RecruitmentPost[]) || [];
}

export async function getClubRecruitmentPosts(
  clubId: string
): Promise<RecruitmentPost[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('recruitment_posts')
    .select(`
      id, club_id, match_id, created_by, type, title, description,
      match_date, location, needed_count, male_slots, female_slots, any_slots,
      ntrp_min, ntrp_max, status, created_at,
      clubs:club_id (name, logo_url, region),
      profiles:created_by (display_name, avatar_url)
    `)
    .eq('club_id', clubId)
    .order('created_at', { ascending: false });

  return (data as unknown as RecruitmentPost[]) || [];
}
