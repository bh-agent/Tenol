'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { FollowButton } from './follow-button';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface FollowUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
  ntrp_level: number | null;
}

interface FollowListModalProps {
  userId: string;
  type: 'followers' | 'following';
  isOpen: boolean;
  onClose: () => void;
  count: number;
}

export function FollowListModal({
  userId,
  type,
  isOpen,
  onClose,
  count,
}: FollowListModalProps) {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      // Fetch follow list
      let query;
      if (type === 'followers') {
        query = supabase
          .from('follows')
          .select('follower_id, profiles:follower_id(id, display_name, avatar_url, ntrp_level)')
          .eq('following_id', userId);
      } else {
        query = supabase
          .from('follows')
          .select('following_id, profiles:following_id(id, display_name, avatar_url, ntrp_level)')
          .eq('follower_id', userId);
      }

      const { data } = await query;

      const fetchedUsers: FollowUser[] = (data || []).map((row: any) => {
        const profile = type === 'followers' ? row.profiles : row.profiles;
        return {
          id: profile?.id ?? '',
          display_name: profile?.display_name ?? '',
          avatar_url: profile?.avatar_url ?? null,
          ntrp_level: profile?.ntrp_level ?? null,
        };
      }).filter((u: FollowUser) => u.id);

      setUsers(fetchedUsers);

      // Check which users the current user follows
      if (user && fetchedUsers.length > 0) {
        const userIds = fetchedUsers.map((u) => u.id);
        const { data: followData } = await supabase
          .from('follows')
          .select('following_id')
          .eq('follower_id', user.id)
          .in('following_id', userIds);

        const map: Record<string, boolean> = {};
        (followData || []).forEach((f: any) => {
          map[f.following_id] = true;
        });
        setFollowingMap(map);
      }

      setLoading(false);
    };

    fetchData();
  }, [isOpen, userId, type]);

  const title = type === 'followers' ? '팔로워' : '팔로잉';
  const emptyMessage =
    type === 'followers'
      ? '아직 팔로워가 없어요'
      : '아직 팔로우하는 사람이 없어요';

  const handleFollowChange = (targetId: string, isFollowing: boolean) => {
    setFollowingMap((prev) => ({ ...prev, [targetId]: isFollowing }));
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${title} ${count}`}
    >
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="w-10 h-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
              <Skeleton className="h-8 w-20 rounded-lg" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-surface-elevated transition-colors"
            >
              <Link
                href={`/profile/${user.id}`}
                onClick={onClose}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <Avatar
                  src={user.avatar_url}
                  alt={user.display_name}
                  fallback={user.display_name}
                  size="md"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {user.display_name}
                  </p>
                  {user.ntrp_level && (
                    <Badge variant="primary" className="text-[10px] mt-0.5">
                      NTRP {user.ntrp_level}
                    </Badge>
                  )}
                </div>
              </Link>

              {currentUserId && currentUserId !== user.id && (
                <FollowButton
                  targetUserId={user.id}
                  isFollowing={!!followingMap[user.id]}
                  size="sm"
                  onFollowChange={(isFollowing) =>
                    handleFollowChange(user.id, isFollowing)
                  }
                />
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
