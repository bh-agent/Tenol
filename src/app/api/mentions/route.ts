import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';
import type { NextRequest } from 'next/server';

export type MentionSource = 'recent_match' | 'following' | 'club_member' | 'search';

export interface MentionUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  ntrp_level: number | null;
  source: MentionSource;
}

const SOURCE_PRIORITY: Record<MentionSource, number> = {
  recent_match: 0,
  following: 1,
  club_member: 2,
  search: 3,
};

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ users: [] }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const query = searchParams.get('q')?.trim() ?? '';
    const clubId = searchParams.get('clubId') ?? undefined;

    const results = new Map<string, MentionUser>();

    const addUser = (
      id: string,
      display_name: string,
      avatar_url: string | null,
      ntrp_level: number | null,
      source: MentionSource
    ) => {
      if (id === user.id) return;
      const existing = results.get(id);
      if (!existing || SOURCE_PRIORITY[source] < SOURCE_PRIORITY[existing.source]) {
        results.set(id, { id, display_name, avatar_url, ntrp_level, source });
      }
    };

    // 1. Recent match opponents (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: myParticipations } = await supabase
      .from('match_participants')
      .select('match_id')
      .eq('user_id', user.id);

    if (myParticipations && myParticipations.length > 0) {
      const matchIds = myParticipations.map((p) => p.match_id);

      // Get matches within last 30 days
      const { data: recentMatches } = await supabase
        .from('matches')
        .select('id')
        .in('id', matchIds)
        .gte('match_date', thirtyDaysAgo.toISOString());

      if (recentMatches && recentMatches.length > 0) {
        const recentMatchIds = recentMatches.map((m) => m.id);

        let opponentQuery = supabase
          .from('match_participants')
          .select('user_id, profiles:user_id (id, display_name, avatar_url, ntrp_level)')
          .in('match_id', recentMatchIds)
          .not('user_id', 'is', null)
          .neq('user_id', user.id);

        const { data: opponents } = await opponentQuery;

        if (opponents) {
          for (const opp of opponents) {
            const p = opp.profiles as unknown as {
              id: string;
              display_name: string;
              avatar_url: string | null;
              ntrp_level: number | null;
            } | null;
            if (p && (!query || p.display_name.toLowerCase().includes(query.toLowerCase()))) {
              addUser(p.id, p.display_name, p.avatar_url, p.ntrp_level, 'recent_match');
            }
          }
        }
      }
    }

    // 2. Following
    const { data: following } = await supabase
      .from('follows')
      .select('profiles:following_id (id, display_name, avatar_url, ntrp_level)')
      .eq('follower_id', user.id);

    if (following) {
      for (const f of following) {
        const p = f.profiles as unknown as {
          id: string;
          display_name: string;
          avatar_url: string | null;
          ntrp_level: number | null;
        } | null;
        if (p && (!query || p.display_name.toLowerCase().includes(query.toLowerCase()))) {
          addUser(p.id, p.display_name, p.avatar_url, p.ntrp_level, 'following');
        }
      }
    }

    // 3. Club members
    if (clubId) {
      // Filter to specific club
      const { data: members } = await supabase
        .from('club_members')
        .select('profiles:user_id (id, display_name, avatar_url, ntrp_level)')
        .eq('club_id', clubId);

      if (members) {
        for (const m of members) {
          const p = m.profiles as unknown as {
            id: string;
            display_name: string;
            avatar_url: string | null;
            ntrp_level: number | null;
          } | null;
          if (p && (!query || p.display_name.toLowerCase().includes(query.toLowerCase()))) {
            addUser(p.id, p.display_name, p.avatar_url, p.ntrp_level, 'club_member');
          }
        }
      }
    } else {
      // All clubs user belongs to
      const { data: myClubs } = await supabase
        .from('club_members')
        .select('club_id')
        .eq('user_id', user.id);

      if (myClubs && myClubs.length > 0) {
        const clubIds = myClubs.map((c) => c.club_id);

        const { data: members } = await supabase
          .from('club_members')
          .select('profiles:user_id (id, display_name, avatar_url, ntrp_level)')
          .in('club_id', clubIds);

        if (members) {
          for (const m of members) {
            const p = m.profiles as unknown as {
              id: string;
              display_name: string;
              avatar_url: string | null;
              ntrp_level: number | null;
            } | null;
            if (p && (!query || p.display_name.toLowerCase().includes(query.toLowerCase()))) {
              addUser(p.id, p.display_name, p.avatar_url, p.ntrp_level, 'club_member');
            }
          }
        }
      }
    }

    // 4. Name search (only when there's a query and we need more results)
    if (query && results.size < 8) {
      const { data: searched } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, ntrp_level')
        .ilike('display_name', `%${query}%`)
        .neq('id', user.id)
        .limit(10);

      if (searched) {
        for (const p of searched) {
          addUser(p.id, p.display_name, p.avatar_url, p.ntrp_level, 'search');
        }
      }
    }

    // Sort by priority, limit to 8
    const users = Array.from(results.values())
      .sort((a, b) => SOURCE_PRIORITY[a.source] - SOURCE_PRIORITY[b.source])
      .slice(0, query ? 8 : 10);

    return Response.json({ users });
  } catch (error) {
    logError('api', 'Mentions query failed', { error, path: '/api/mentions' });
    return Response.json({ users: [] }, { status: 500 });
  }
}
