import { createClient } from '@/lib/supabase/server';

export async function getClubMedia(clubId: string) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('media')
    .select(`
      id, file_url, file_urls, file_type, caption, created_at, match_id, uploaded_by,
      profiles:uploaded_by (id, display_name, avatar_url)
    `)
    .eq('club_id', clubId)
    .eq('feed_type', 'club')
    .order('created_at', { ascending: false });

  return data || [];
}
