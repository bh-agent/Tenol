import { createClient } from '@/lib/supabase/server';

/**
 * 팔로우 상태 조회
 */
export async function getFollowStatus(targetUserId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [followerResult, followingResult, postResult, isFollowingResult] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', targetUserId),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', targetUserId),
    supabase
      .from('media')
      .select('*', { count: 'exact', head: true })
      .eq('uploaded_by', targetUserId)
      .eq('feed_type', 'personal'),
    user
      ? supabase
          .from('follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('following_id', targetUserId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    isFollowing: !!isFollowingResult.data,
    followerCount: followerResult.count ?? 0,
    followingCount: followingResult.count ?? 0,
    postCount: postResult.count ?? 0,
    isOwnProfile: user?.id === targetUserId,
  };
}

/**
 * 팔로워 목록 (follow-back 상태 포함)
 */
export async function getFollowers(userId: string, limit = 50) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: followers } = await supabase
    .from('follows')
    .select(`
      id, created_at,
      profiles:follower_id (id, display_name, avatar_url, bio, ntrp_level)
    `)
    .eq('following_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!followers || followers.length === 0) return [];

  // 현재 사용자가 이 팔로워들을 팔로우하고 있는지 확인 (follow-back 상태)
  if (user) {
    const followerIds = followers
      .map((f) => {
        const p = f.profiles as unknown as { id: string } | null;
        return p?.id;
      })
      .filter(Boolean) as string[];

    const { data: followBacks } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)
      .in('following_id', followerIds);

    const followBackSet = new Set(followBacks?.map((fb) => fb.following_id) ?? []);

    return followers.map((f) => {
      const profile = f.profiles as unknown as { id: string } | null;
      return {
        ...f,
        is_following_back: profile ? followBackSet.has(profile.id) : false,
      };
    });
  }

  return followers.map((f) => ({ ...f, is_following_back: false }));
}

/**
 * 팔로잉 목록
 */
export async function getFollowing(userId: string, limit = 50) {
  const supabase = await createClient();

  const { data } = await supabase
    .from('follows')
    .select(`
      id, created_at,
      profiles:following_id (id, display_name, avatar_url, bio, ntrp_level)
    `)
    .eq('follower_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data || [];
}

/**
 * 팔로잉 피드 - 팔로우하는 유저들의 게시물
 */
export async function getFollowingFeed(limit = 50) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 팔로잉 목록 조회
  const { data: followings } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  if (!followings || followings.length === 0) return [];

  const followingIds = followings.map((f) => f.following_id);

  // 팔로잉 유저들의 게시물 조회
  const { data } = await supabase
    .from('media_with_counts')
    .select(`
      id, club_id, file_url, file_urls, file_type, caption, feed_type,
      created_at, match_id, uploaded_by, like_count, comment_count,
      profiles:uploaded_by (display_name, avatar_url)
    `)
    .in('uploaded_by', followingIds)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  // 현재 사용자의 좋아요 상태 조회
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

/**
 * 탐색 피드 - 팔로우하지 않는 유저들의 인기/최신 게시물
 * 현재 사용자의 클럽 게시물도 포함
 */
export async function getDiscoverFeed(limit = 50) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 팔로잉 목록 조회
  const { data: followings } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  const followingIds = followings?.map((f) => f.following_id) ?? [];
  // 자신 + 팔로잉 유저 제외
  const excludeIds = [user.id, ...followingIds];

  // 사용자가 속한 클럽 조회
  const { data: memberships } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id);

  const clubIds = memberships?.map((m) => m.club_id) ?? [];

  // 팔로우하지 않는 유저 + 같은 클럽 게시물을 합쳐서 조회
  // 1) 팔로우하지 않는 유저의 게시물
  let query = supabase
    .from('media_with_counts')
    .select(`
      id, club_id, file_url, file_urls, file_type, caption, feed_type,
      created_at, match_id, uploaded_by, like_count, comment_count,
      profiles:uploaded_by (display_name, avatar_url)
    `);

  if (clubIds.length > 0) {
    // 팔로우하지 않는 유저의 게시물 OR 같은 클럽의 게시물 (본인 제외)
    query = query
      .not('uploaded_by', 'eq', user.id)
      .or(
        `uploaded_by.not.in.(${excludeIds.map((id) => `"${id}"`).join(',')}),` +
        `club_id.in.(${clubIds.map((id) => `"${id}"`).join(',')})`
      );
  } else {
    query = query
      .not('uploaded_by', 'in', `(${excludeIds.join(',')})`);
  }

  const { data } = await query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (!data) return [];

  // 현재 사용자의 좋아요 상태 조회
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

/**
 * 추천 유저 - 팔로우할 만한 사용자 추천
 * - 같은 클럽 멤버
 * - 친구의 친구 (팔로잉의 팔로잉)
 * - 최근 활동이 있는 유저
 * 이미 팔로우 중인 유저 제외
 */
export async function getSuggestedUsers(limit = 10) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 이미 팔로우 중인 유저 목록
  const { data: followings } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id);

  const followingIds = followings?.map((f) => f.following_id) ?? [];
  const excludeIds = [user.id, ...followingIds];

  // 1) 같은 클럽 멤버
  const { data: myClubs } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', user.id);

  const clubIds = myClubs?.map((c) => c.club_id) ?? [];

  let clubMemberIds: string[] = [];
  if (clubIds.length > 0) {
    const { data: clubMembers } = await supabase
      .from('club_members')
      .select('user_id')
      .in('club_id', clubIds)
      .not('user_id', 'in', `(${excludeIds.join(',')})`)
      .limit(50);

    clubMemberIds = clubMembers?.map((m) => m.user_id) ?? [];
  }

  // 2) 친구의 친구 (팔로잉의 팔로잉)
  let friendOfFriendIds: string[] = [];
  if (followingIds.length > 0) {
    const { data: fof } = await supabase
      .from('follows')
      .select('following_id')
      .in('follower_id', followingIds)
      .not('following_id', 'in', `(${excludeIds.join(',')})`)
      .limit(50);

    friendOfFriendIds = fof?.map((f) => f.following_id) ?? [];
  }

  // 후보 ID 합치기 (중복 제거)
  const candidateIds = [...new Set([...clubMemberIds, ...friendOfFriendIds])];

  if (candidateIds.length > 0) {
    // 후보가 있으면 프로필 조회
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, bio, ntrp_level')
      .in('id', candidateIds)
      .limit(limit);

    if (profiles && profiles.length > 0) return profiles;
  }

  // 후보가 부족하면 최근 활동이 있는 유저로 보충
  const { data: activeUsers } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, bio, ntrp_level')
    .not('id', 'in', `(${excludeIds.join(',')})`)
    .order('updated_at', { ascending: false })
    .limit(limit);

  return activeUsers || [];
}
