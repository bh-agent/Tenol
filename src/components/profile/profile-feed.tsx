'use client';

import { MultiUpload } from '@/components/media/multi-upload';
import { PostCard } from '@/components/media/post-card';
import { savePersonalMedia } from '@/lib/actions/media';
import { createClient } from '@/lib/supabase/client';
import { Camera } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ProfileFeedProps {
  userId: string;
}

type FeedItem = {
  id: string;
  file_url: string | null;
  file_urls: { url: string; type: string }[] | null;
  file_type: string | null;
  caption: string | null;
  created_at: string;
  uploaded_by: string;
};

export function ProfileFeed({ userId }: ProfileFeedProps) {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPosts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('media')
      .select('id, file_url, file_urls, file_type, caption, created_at, uploaded_by')
      .eq('uploaded_by', userId)
      .eq('feed_type', 'personal')
      .order('created_at', { ascending: false });

    setPosts(data || []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleUpload = async (
    files: { url: string; type: 'image' | 'video' }[],
    caption: string | null
  ) => {
    await savePersonalMedia(files, caption);
    await loadPosts();
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2 text-foreground">
        <Camera className="w-4 h-4 text-primary" />
        개인 피드
      </h3>

      <MultiUpload
        storagePath={`personal/${userId}`}
        onUpload={handleUpload}
      />

      {loading ? (
        <div className="text-center py-8 text-muted-foreground text-sm">로딩 중...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <div className="w-16 h-16 rounded-full bg-surface-elevated flex items-center justify-center mx-auto mb-3">
            <Camera className="w-8 h-8 opacity-50" />
          </div>
          <p className="text-sm font-medium">아직 올린 게시물이 없어요</p>
          <p className="text-xs mt-1">테니스 일상을 공유해보세요!</p>
        </div>
      ) : (
        <div className="space-y-4 stagger">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={{
                ...post,
                profiles: { id: userId, display_name: '나', avatar_url: null },
              }}
              currentUserId={userId}
              onDeleted={loadPosts}
              onUpdated={loadPosts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
