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

/**
 * 클럽 피드 (좋아요/댓글 수 포함)
 */
export async function getClubFeedWithCounts(clubId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from('media_with_counts')
    .select(`
      id, club_id, file_url, file_urls, file_type, caption, feed_type,
      created_at, match_id, uploaded_by, like_count, comment_count,
      profiles:uploaded_by (display_name, avatar_url)
    `)
    .eq('club_id', clubId)
    .eq('feed_type', 'club')
    .order('created_at', { ascending: false });

  if (!data) return [];

  // 현재 사용자의 좋아요 상태 조회
  if (user) {
    const mediaIds = data.map((m) => m.id);
    const { data: likes } = await supabase
      .from('media_likes')
      .select('media_id')
      .eq('user_id', user.id)
      .in('media_id', mediaIds);

    const likedSet = new Set(likes?.map((l) => l.media_id) ?? []);
    return data.map((m) => ({ ...m, is_liked: likedSet.has(m.id) }));
  }

  return data.map((m) => ({ ...m, is_liked: false }));
}

/**
 * 특정 사용자의 개인 피드
 */
export async function getUserFeed(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from('media_with_counts')
    .select(`
      id, club_id, file_url, file_urls, file_type, caption, feed_type,
      created_at, match_id, uploaded_by, like_count, comment_count,
      profiles:uploaded_by (display_name, avatar_url)
    `)
    .eq('uploaded_by', userId)
    .eq('feed_type', 'personal')
    .order('created_at', { ascending: false });

  if (!data) return [];

  // 현재 사용자의 좋아요 상태 조회
  if (user) {
    const mediaIds = data.map((m) => m.id);
    const { data: likes } = await supabase
      .from('media_likes')
      .select('media_id')
      .eq('user_id', user.id)
      .in('media_id', mediaIds);

    const likedSet = new Set(likes?.map((l) => l.media_id) ?? []);
    return data.map((m) => ({ ...m, is_liked: likedSet.has(m.id) }));
  }

  return data.map((m) => ({ ...m, is_liked: false }));
}

/**
 * 게시물 댓글 목록
 */
export async function getMediaComments(mediaId: string, limit = 20) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('media_comments')
    .select(`
      id, media_id, user_id, body, created_at,
      profiles:user_id (display_name, avatar_url)
    `)
    .eq('media_id', mediaId)
    .order('created_at', { ascending: true })
    .limit(limit);

  return data || [];
}

/**
 * 피드 게시물별 최신 댓글 2개 (CommentPreview 용)
 * mediaIds 배열에 대해 한 번에 조회하여 { [mediaId]: Comment[] } 맵 반환
 */
export async function getLatestCommentsForFeed(mediaIds: string[]) {
  if (mediaIds.length === 0) return {} as Record<string, { id: string; user_id: string; body: string; profiles?: { display_name: string } | null }[]>;

  const supabase = await createClient();

  // Fetch latest 2 comments per media using a window-function-like approach:
  // We fetch all recent comments ordered by created_at desc, then group client-side.
  // For efficiency, limit to 2 * mediaIds.length (at most 2 per post).
  const { data } = await supabase
    .from('media_comments')
    .select(`
      id, media_id, user_id, body, created_at,
      profiles:user_id (display_name)
    `)
    .in('media_id', mediaIds)
    .order('created_at', { ascending: false })
    .limit(mediaIds.length * 2);

  const map: Record<string, { id: string; user_id: string; body: string; profiles?: { display_name: string } | null }[]> = {};
  for (const row of data ?? []) {
    const list = map[row.media_id] ?? [];
    if (list.length < 2) {
      list.push({
        id: row.id,
        user_id: row.user_id,
        body: row.body,
        profiles: Array.isArray(row.profiles) ? row.profiles[0] as { display_name: string } | null : row.profiles as { display_name: string } | null,
      });
      map[row.media_id] = list;
    }
  }
  return map;
}

/**
 * 특정 사용자가 업로드한 개인 미디어만 (클럽 미디어 제외)
 */
export async function getUserMedia(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data } = await supabase
    .from('media_with_counts')
    .select(`
      id, club_id, file_url, file_urls, file_type, caption, feed_type,
      created_at, match_id, uploaded_by, like_count, comment_count,
      profiles:uploaded_by (id, display_name, avatar_url)
    `)
    .eq('uploaded_by', userId)
    .eq('feed_type', 'personal')
    .order('created_at', { ascending: false });

  if (!data) return [];

  if (user) {
    const mediaIds = data.map((m) => m.id);
    if (mediaIds.length === 0) return data.map((m) => ({ ...m, is_liked: false }));

    const { data: likes } = await supabase
      .from('media_likes')
      .select('media_id')
      .eq('user_id', user.id)
      .in('media_id', mediaIds);

    const likedSet = new Set(likes?.map((l) => l.media_id) ?? []);
    return data.map((m) => ({ ...m, is_liked: likedSet.has(m.id) }));
  }

  return data.map((m) => ({ ...m, is_liked: false }));
}

/**
 * 특정 사용자가 언급된 게시물 (멘션 탭)
 */
export async function getMentionedMedia(userId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Get media IDs where user is mentioned
  const { data: mentions } = await supabase
    .from('media_mentions')
    .select('media_id')
    .eq('mentioned_user_id', userId)
    .order('created_at', { ascending: false });

  if (!mentions || mentions.length === 0) return [];

  const mediaIds = mentions.map((m) => m.media_id);

  const { data } = await supabase
    .from('media_with_counts')
    .select(`
      id, club_id, file_url, file_urls, file_type, caption, feed_type,
      created_at, match_id, uploaded_by, like_count, comment_count,
      profiles:uploaded_by (id, display_name, avatar_url)
    `)
    .in('id', mediaIds)
    .order('created_at', { ascending: false });

  if (!data) return [];

  if (user) {
    const ids = data.map((m) => m.id);
    if (ids.length === 0) return data.map((m) => ({ ...m, is_liked: false }));

    const { data: likes } = await supabase
      .from('media_likes')
      .select('media_id')
      .eq('user_id', user.id)
      .in('media_id', ids);

    const likedSet = new Set(likes?.map((l) => l.media_id) ?? []);
    return data.map((m) => ({ ...m, is_liked: likedSet.has(m.id) }));
  }

  return data.map((m) => ({ ...m, is_liked: false }));
}

export async function getMediaLikeStatus(mediaId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { count } = await supabase
    .from('media_likes')
    .select('*', { count: 'exact', head: true })
    .eq('media_id', mediaId);

  let isLiked = false;
  if (user) {
    const { data: existing } = await supabase
      .from('media_likes')
      .select('id')
      .eq('media_id', mediaId)
      .eq('user_id', user.id)
      .maybeSingle();

    isLiked = !!existing;
  }

  return { isLiked, likeCount: count ?? 0 };
}
