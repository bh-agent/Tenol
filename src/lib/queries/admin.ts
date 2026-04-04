import { createClient } from '@/lib/supabase/server';

const PAGE_SIZE = 20;

export async function getAdminStats() {
  const supabase = await createClient();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  const [users, clubs, matches, todaySignups] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('clubs').select('id', { count: 'exact', head: true }),
    supabase.from('matches').select('id', { count: 'exact', head: true }),
    supabase.from('profiles').select('id', { count: 'exact', head: true }).gte('created_at', todayISO),
  ]);

  return {
    userCount: users.count || 0,
    clubCount: clubs.count || 0,
    matchCount: matches.count || 0,
    todaySignups: todaySignups.count || 0,
  };
}

export async function getRecentUsers(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, ntrp_level, gender, is_banned, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getRecentClubs(limit = 5) {
  const supabase = await createClient();
  const { data } = await supabase
    .from('clubs')
    .select('id, name, logo_url, region, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data || [];
}

export async function getUsers(query?: string, page = 1) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from('profiles')
    .select('id, display_name, real_name, avatar_url, ntrp_level, gender, region, is_onboarded, is_admin, is_banned, banned_reason, created_at', { count: 'exact' });

  if (query?.trim()) {
    q = q.or(`display_name.ilike.%${query.trim()}%,real_name.ilike.%${query.trim()}%`);
  }

  q = q.order('created_at', { ascending: false }).range(from, to);

  const { data, count } = await q;
  return { users: data || [], total: count || 0, page, pageSize: PAGE_SIZE };
}

export async function getClubs(query?: string, page = 1) {
  const supabase = await createClient();
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let q = supabase
    .from('clubs')
    .select('id, name, description, logo_url, region, is_public, created_by, created_at', { count: 'exact' });

  if (query?.trim()) {
    q = q.ilike('name', `%${query.trim()}%`);
  }

  q = q.order('created_at', { ascending: false }).range(from, to);

  const { data, count } = await q;

  // 멤버 수 조회
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

  return {
    clubs: (data || []).map((c) => ({ ...c, member_count: memberCounts[c.id] || 0 })),
    total: count || 0,
    page,
    pageSize: PAGE_SIZE,
  };
}
