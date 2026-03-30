import { createClient } from '@/lib/supabase/server';

export type FeedSource = 'following' | 'bookmarked_club' | 'my_club' | 'discovery';

export type FeedPost = {
  id: string;
  club_id: string | null;
  file_url: string;
  file_urls?: { url: string; type: string }[];
  file_type: string;
  caption: string | null;
  feed_type: string;
  created_at: string;
  match_id: string | null;
  uploaded_by: string;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
  profiles?: { display_name: string; avatar_url: string | null };
  feed_source: FeedSource;
};

const MEDIA_SELECT = `
  id, club_id, file_url, file_urls, file_type, caption, feed_type,
  created_at, match_id, uploaded_by, like_count, comment_count,
  profiles:uploaded_by (display_name, avatar_url)
`;

/**
 * Engagement score for ranking:
 * score = (like_count * 2) + (comment_count * 3) + recency_bonus
 * recency_bonus = max(0, 10 - hours_since_posted / 24)
 */
function computeEngagementScore(post: { like_count: number; comment_count: number; created_at: string }): number {
  const hoursSincePosted = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
  const recencyBonus = Math.max(0, 10 - hoursSincePosted / 24);
  return (post.like_count * 2) + (post.comment_count * 3) + recencyBonus;
}

/**
 * Attach is_liked status to posts for the current user
 */
async function attachLikeStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  posts: any[]
): Promise<any[]> {
  if (posts.length === 0) return posts;
  const mediaIds = posts.map((p) => p.id);
  const { data: likes } = await supabase
    .from('media_likes')
    .select('media_id')
    .eq('user_id', userId)
    .in('media_id', mediaIds);
  const likedSet = new Set(likes?.map((l) => l.media_id) ?? []);
  return posts.map((p) => ({ ...p, is_liked: likedSet.has(p.id) }));
}

/**
 * Unified smart feed - merges following, bookmarked clubs, member clubs, and discovery
 */
export async function getUnifiedFeed(limit = 30): Promise<FeedPost[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch user context in parallel
  const [followingsRes, bookmarksRes, membershipsRes] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', user.id),
    supabase.from('club_bookmarks').select('club_id').eq('user_id', user.id),
    supabase.from('club_members').select('club_id').eq('user_id', user.id),
  ]);

  const followingIds = followingsRes.data?.map((f) => f.following_id) ?? [];
  const bookmarkedClubIds = bookmarksRes.data?.map((b) => b.club_id) ?? [];
  const memberClubIds = membershipsRes.data?.map((m) => m.club_id) ?? [];

  const seenIds = new Set<string>();
  const allPosts: FeedPost[] = [];

  // ── Tier 1: Following + Bookmarked clubs (last 7 days) ──
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const tier1Promises: PromiseLike<any>[] = [];

  // 1a) Posts from followed users
  if (followingIds.length > 0) {
    tier1Promises.push(
      supabase
        .from('media_with_counts')
        .select(MEDIA_SELECT)
        .in('uploaded_by', followingIds)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data }) =>
          (data ?? []).map((p: any) => ({ ...p, feed_source: 'following' as FeedSource }))
        )
    );
  }

  // 1b) Posts from bookmarked clubs
  if (bookmarkedClubIds.length > 0) {
    tier1Promises.push(
      supabase
        .from('media_with_counts')
        .select(MEDIA_SELECT)
        .in('club_id', bookmarkedClubIds)
        .not('uploaded_by', 'eq', user.id)
        .gte('created_at', sevenDaysAgo)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data }) =>
          (data ?? []).map((p: any) => ({ ...p, feed_source: 'bookmarked_club' as FeedSource }))
        )
    );
  }

  const tier1Results = await Promise.all(tier1Promises);
  const tier1Posts = tier1Results.flat();

  // Sort tier 1 by created_at DESC, deduplicate (following takes priority over bookmarked_club)
  tier1Posts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  for (const post of tier1Posts) {
    if (!seenIds.has(post.id)) {
      seenIds.add(post.id);
      allPosts.push(post);
    }
  }

  // ── Tier 2: Member clubs + friends-of-friends (scored) ──
  const tier2Promises: PromiseLike<any>[] = [];

  // 2a) Posts from member clubs (excluding bookmarked clubs already covered)
  const nonBookmarkedClubIds = memberClubIds.filter((id) => !bookmarkedClubIds.includes(id));
  if (nonBookmarkedClubIds.length > 0) {
    tier2Promises.push(
      supabase
        .from('media_with_counts')
        .select(MEDIA_SELECT)
        .in('club_id', nonBookmarkedClubIds)
        .not('uploaded_by', 'eq', user.id)
        .order('created_at', { ascending: false })
        .limit(limit)
        .then(({ data }) =>
          (data ?? []).map((p: any) => ({ ...p, feed_source: 'my_club' as FeedSource }))
        )
    );
  }

  // 2b) Friends-of-friends posts
  if (followingIds.length > 0) {
    // Get friends-of-friends IDs
    const { data: fofData } = await supabase
      .from('follows')
      .select('following_id')
      .in('follower_id', followingIds)
      .not('following_id', 'in', `(${[user.id, ...followingIds].join(',')})`)
      .limit(50);

    const fofIds = [...new Set(fofData?.map((f) => f.following_id) ?? [])];
    if (fofIds.length > 0) {
      tier2Promises.push(
        supabase
          .from('media_with_counts')
          .select(MEDIA_SELECT)
          .in('uploaded_by', fofIds)
          .order('created_at', { ascending: false })
          .limit(limit)
          .then(({ data }) =>
            (data ?? []).map((p: any) => ({ ...p, feed_source: 'discovery' as FeedSource }))
          )
      );
    }
  }

  const tier2Results = await Promise.all(tier2Promises);
  const tier2Posts = tier2Results.flat();

  // Sort tier 2 by engagement score
  tier2Posts.sort((a, b) => computeEngagementScore(b) - computeEngagementScore(a));
  for (const post of tier2Posts) {
    if (!seenIds.has(post.id)) {
      seenIds.add(post.id);
      allPosts.push(post);
    }
  }

  // ── Tier 3: Discovery (popular community posts) ──
  const remainingSlots = Math.max(0, limit - allPosts.length);
  if (remainingSlots > 0) {
    const query = supabase
      .from('media_with_counts')
      .select(MEDIA_SELECT)
      .not('uploaded_by', 'eq', user.id)
      .order('created_at', { ascending: false })
      .limit(remainingSlots + seenIds.size); // fetch extra to account for dedup

    // Exclude already-seen posts if there are any
    if (seenIds.size > 0) {
      // Filter client-side since we already have the seen IDs in memory
      const { data: discoverData } = await query;
      const tier3Posts = (discoverData ?? [])
        .filter((p: any) => !seenIds.has(p.id))
        .slice(0, remainingSlots)
        .map((p: any) => ({ ...p, feed_source: 'discovery' as FeedSource }));

      // Sort by engagement score
      tier3Posts.sort((a: any, b: any) => computeEngagementScore(b) - computeEngagementScore(a));
      for (const post of tier3Posts) {
        seenIds.add(post.id);
        allPosts.push(post);
      }
    } else {
      const { data: discoverData } = await query;
      const tier3Posts = (discoverData ?? [])
        .slice(0, remainingSlots)
        .map((p: any) => ({ ...p, feed_source: 'discovery' as FeedSource }));

      for (const post of tier3Posts) {
        seenIds.add(post.id);
        allPosts.push(post);
      }
    }
  }

  // Attach like status
  const finalPosts = await attachLikeStatus(supabase, user.id, allPosts.slice(0, limit));
  return finalPosts as FeedPost[];
}

/**
 * Load more posts for pagination (used by API endpoint)
 * @param excludeIds - post IDs already displayed, to avoid duplicates
 */
export async function getMoreFeed(offset = 30, limit = 20, excludeIds: string[] = []): Promise<FeedPost[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Fetch extra rows to compensate for filtering out already-shown posts
  const fetchLimit = limit + Math.min(excludeIds.length, 50);

  const { data } = await supabase
    .from('media_with_counts')
    .select(MEDIA_SELECT)
    .not('uploaded_by', 'eq', user.id)
    .order('created_at', { ascending: false })
    .range(offset, offset + fetchLimit - 1);

  if (!data || data.length === 0) return [];

  const excludeSet = new Set(excludeIds);
  const filtered = data.filter((p: any) => !excludeSet.has(p.id)).slice(0, limit);

  const posts = filtered.map((p: any) => ({ ...p, feed_source: 'discovery' as FeedSource }));
  const withLikes = await attachLikeStatus(supabase, user.id, posts);
  return withLikes as FeedPost[];
}
