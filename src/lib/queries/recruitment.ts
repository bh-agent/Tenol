import { createClient } from '@/lib/supabase/server';
import type { RecruitmentType, RecruitmentPost } from '@/types';

export async function getRecruitmentPosts(
  type?: RecruitmentType,
  limit = 20
): Promise<RecruitmentPost[]> {
  const supabase = await createClient();

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

  const { data } = await query;
  return (data as unknown as RecruitmentPost[]) || [];
}

export async function searchRecruitmentPosts(
  searchQuery?: string,
  type?: RecruitmentType,
  limit = 20
): Promise<RecruitmentPost[]> {
  const supabase = await createClient();

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
