import { createClient } from '@/lib/supabase/server';
import { logError } from '@/lib/logger';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return Response.json({ error: '로그인이 필요합니다' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const q = searchParams.get('q')?.trim() || '';
    const ntrp = searchParams.get('ntrp');
    const region = searchParams.get('region');
    const gender = searchParams.get('gender');

    let query = supabase
      .from('profiles')
      .select('id, display_name, real_name, avatar_url, ntrp_level, gender, region, bio')
      .eq('is_onboarded', true)
      .order('display_name', { ascending: true })
      .limit(30);

    // Text search: display_name or real_name
    if (q) {
      query = query.or(`display_name.ilike.%${q}%,real_name.ilike.%${q}%`);
    }

    // NTRP filter
    if (ntrp) {
      const ntrpNum = parseFloat(ntrp);
      if (!isNaN(ntrpNum)) {
        query = query.eq('ntrp_level', ntrpNum);
      }
    }

    // Region filter (partial match - sido level)
    if (region) {
      query = query.ilike('region', `${region}%`);
    }

    // Gender filter
    if (gender === 'M' || gender === 'F') {
      query = query.eq('gender', gender);
    }

    const { data, error } = await query;

    if (error) {
      logError('api', 'Search query failed', { error, path: '/api/search', userId: user.id });
      return Response.json({ error: '검색 중 오류가 발생했습니다' }, { status: 500 });
    }

    return Response.json({ results: data ?? [] });
  } catch (error) {
    logError('api', 'Search endpoint error', { error, path: '/api/search' });
    return Response.json({ error: '서버 오류가 발생했습니다' }, { status: 500 });
  }
}
