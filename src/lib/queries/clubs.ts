import { createClient } from '@/lib/supabase/server';

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
    .single();

  return data?.role || null;
}

export async function searchPublicClubs(query?: string, region?: string) {
  const supabase = await createClient();

  let q = supabase
    .from('clubs')
    .select(`
      id, name, description, logo_url, region, main_court, is_public, created_at,
      club_members (id)
    `)
    .eq('is_public', true);

  if (query && query.trim()) {
    q = q.ilike('name', `%${query.trim()}%`);
  }

  if (region && region !== 'all') {
    q = q.eq('region', region);
  }

  q = q.order('created_at', { ascending: false });

  const { data } = await q;

  return (data || []).map((club) => ({
    ...club,
    member_count: club.club_members?.length || 0,
    club_members: undefined,
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
