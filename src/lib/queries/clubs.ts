import { createClient } from '@/lib/supabase/server';
import type { ClubJoinRequest } from '@/types';

export async function getMyClubs() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('club_members')
    .select(`
      club_id,
      role,
      clubs (
        id, name, description, logo_url, region, main_court, invite_code, is_public, created_at
      )
    `)
    .eq('user_id', user.id)
    .order('joined_at', { ascending: false });

  return data?.map((m) => ({ ...m.clubs, role: m.role })) || [];
}

export async function getClub(clubId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('clubs')
    .select('*')
    .eq('id', clubId)
    .single();

  return data;
}

export async function getClubMembers(clubId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('club_members')
    .select(`
      id, role, joined_at,
      profiles:user_id (
        id, display_name, avatar_url, ntrp_level, gender
      )
    `)
    .eq('club_id', clubId)
    .order('role')
    .order('joined_at');

  return data || [];
}

export async function getClubMemberCount(clubId: string) {
  const supabase = await createClient();

  const { count } = await supabase
    .from('club_members')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId);

  return count || 0;
}

export async function getMyRole(clubId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('club_members')
    .select('role')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .maybeSingle();

  return data?.role || null;
}

export async function searchPublicClubs(query?: string, region?: string) {
  const supabase = await createClient();

  let q = supabase
    .from('clubs_with_bookmark_count')
    .select(`
      id, name, description, logo_url, region, main_court, is_public, created_at, bookmark_count
    `)
    .eq('is_public', true);

  if (query && query.trim()) {
    q = q.ilike('name', `%${query.trim()}%`);
  }

  if (region && region !== 'all') {
    q = q.eq('region', region);
  }

  q = q.order('bookmark_count', { ascending: false })
    .order('created_at', { ascending: false });

  const { data } = await q;

  // Batch-fetch member counts for returned clubs
  const clubIds = (data || []).map((c) => c.id);
  let memberCounts: Record<string, number> = {};
  if (clubIds.length > 0) {
    const { data: members } = await supabase
      .from('club_members')
      .select('club_id')
      .in('club_id', clubIds);

    if (members) {
      for (const m of members) {
        memberCounts[m.club_id] = (memberCounts[m.club_id] || 0) + 1;
      }
    }
  }

  return (data || []).map((club) => ({
    ...club,
    member_count: memberCounts[club.id] || 0,
  }));
}

export async function getClubStats(clubId: string) {
  const supabase = await createClient();

  const [memberResult, matchResult] = await Promise.all([
    supabase
      .from('club_members')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId),
    supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('club_id', clubId),
  ]);

  return {
    memberCount: memberResult.count || 0,
    matchCount: matchResult.count || 0,
  };
}

export async function getPendingJoinRequests(clubId: string): Promise<ClubJoinRequest[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('club_join_requests')
    .select(`
      id, club_id, user_id, message, introduction, status, responded_by, created_at, responded_at,
      profiles:user_id (
        id, display_name, avatar_url, ntrp_level, gender, tennis_start_date, bio, real_name
      )
    `)
    .eq('club_id', clubId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  return (data as unknown as ClubJoinRequest[]) || [];
}

export async function getMyJoinRequestStatus(clubId: string): Promise<ClubJoinRequest | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('club_join_requests')
    .select('id, club_id, user_id, message, status, responded_by, created_at, responded_at')
    .eq('club_id', clubId)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data as ClubJoinRequest | null;
}

export async function getMyJoinRequestsForClubs(clubIds: string[]): Promise<Record<string, ClubJoinRequest>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || clubIds.length === 0) return {};

  const { data } = await supabase
    .from('club_join_requests')
    .select('id, club_id, user_id, message, status, created_at, responded_at')
    .eq('user_id', user.id)
    .in('club_id', clubIds);

  const map: Record<string, ClubJoinRequest> = {};
  for (const req of (data || []) as ClubJoinRequest[]) {
    map[req.club_id] = req;
  }
  return map;
}

export type PendingGuestApplication = {
  id: string;
  match_id: string;
  user_id: string | null;
  guest_name: string | null;
  participant_type: string;
  status: string;
  ntrp_override: number | null;
  introduction: string | null;
  created_at: string;
  match_title: string;
  match_date: string;
  profiles?: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    ntrp_level: number | null;
    tennis_start_date: string | null;
  } | null;
};

export async function getPendingGuestApplications(clubId: string): Promise<PendingGuestApplication[]> {
  const supabase = await createClient();

  // Try with all columns first, fallback if introduction/bio columns don't exist
  let data: any[] | null = null;

  const result = await supabase
    .from('match_participants')
    .select(`
      id, match_id, user_id, guest_name, participant_type, status, ntrp_override, introduction, requested_at,
      matches!inner (id, club_id, title, match_date),
      profiles:user_id (id, display_name, avatar_url, ntrp_level, tennis_start_date)
    `)
    .eq('matches.club_id', clubId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false });

  if (result.error) {
    // Fallback without introduction column
    const fallback = await supabase
      .from('match_participants')
      .select(`
        id, match_id, user_id, guest_name, participant_type, status, ntrp_override, requested_at,
        matches!inner (id, club_id, title, match_date),
        profiles:user_id (id, display_name, avatar_url, ntrp_level, tennis_start_date)
      `)
      .eq('matches.club_id', clubId)
      .eq('status', 'pending')
      .order('requested_at', { ascending: false });
    data = fallback.data;
  } else {
    data = result.data;
  }

  if (!data) return [];

  return data.map((row: any) => ({
    id: row.id,
    match_id: row.match_id,
    user_id: row.user_id,
    guest_name: row.guest_name,
    participant_type: row.participant_type,
    status: row.status,
    ntrp_override: row.ntrp_override,
    introduction: row.introduction ?? null,
    created_at: row.requested_at,
    match_title: row.matches?.title || '제목 없음',
    match_date: row.matches?.match_date || '',
    profiles: row.profiles || null,
  }));
}

export async function getMyMembershipClubIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id);

  return (data || []).map((m: any) => m.club_id);
}
