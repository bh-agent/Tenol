'use client';

import { MultiUpload } from '@/components/media/multi-upload';
import { PostCard } from '@/components/media/post-card';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { savePersonalMedia } from '@/lib/actions/media';
import { createClient } from '@/lib/supabase/client';
import { EmptyState } from '@/components/ui/empty-state';
import { Camera, Grid3X3, List } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

interface ProfileFeedProps {
  userId: string;
  isOwnProfile?: boolean;
}

type MediaFile = { url: string; type: string };

type FeedItem = {
  id: string;
  file_url: string | null;
  file_urls: MediaFile[] | null;
  file_type: string | null;
  caption: string | null;
  created_at: string;
  uploaded_by: string;
  like_count?: number;
  comment_count?: number;
  profiles?: { display_name: string; avatar_url: string | null } | null;
};

export function ProfileFeed({ userId, isOwnProfile = true }: ProfileFeedProps) {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadPosts = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('media')
      .select('id, file_url, file_urls, file_type, caption, created_at, uploaded_by')
      .eq('uploaded_by', userId)
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
    setShowUploadModal(false);
    await loadPosts();
  };

  const getThumbUrl = (post: FeedItem): string | null => {
    if (post.file_urls && post.file_urls.length > 0) {
      return post.file_urls[0].url;
    }
    return post.file_url;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2 text-foreground">
            <Camera className="w-4 h-4 text-primary" />
            피드
          </h3>
        </div>
        <div className="grid grid-cols-3 gap-[2px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 relative">
      {/* Header with view toggle */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2 text-foreground">
          <Camera className="w-4 h-4 text-primary" />
          피드
          {posts.length > 0 && (
            <span className="text-xs text-muted-foreground font-normal">{posts.length}</span>
          )}
        </h3>
        {posts.length > 0 && (
          <div className="flex items-center gap-1 bg-surface-elevated rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'grid'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="격자 보기"
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${
                viewMode === 'list'
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              aria-label="목록 보기"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Empty state */}
      {posts.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="아직 올린 게시물이 없어요"
          description="테니스 일상을 공유해보세요!"
        />
      ) : viewMode === 'grid' ? (
        /* Instagram-style grid (3 columns, square thumbnails) */
        <div className="grid grid-cols-3 gap-[2px] rounded-xl overflow-hidden">
          {posts.map((post, index) => {
            const thumbUrl = getThumbUrl(post);
            if (!thumbUrl) return null;
            const isVideo = post.file_type === 'video' || (post.file_urls?.[0]?.type === 'video');
            return (
              <button
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="relative aspect-square bg-surface-elevated overflow-hidden group animate-fade-in"
                style={{ animationDelay: `${Math.min(index * 40, 300)}ms` }}
              >
                <Image
                  src={thumbUrl}
                  alt={post.caption || ''}
                  fill
                  className="object-cover transition-transform duration-200 group-hover:scale-105"
                  sizes="(max-width: 640px) 33vw, 200px"
                />
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                  {post.file_urls && post.file_urls.length > 1 && (
                    <span className="text-white text-xs font-medium bg-black/50 px-2 py-0.5 rounded-full">
                      +{post.file_urls.length - 1}
                    </span>
                  )}
                </div>
                {/* Video indicator */}
                {isVideo && (
                  <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-black/50 rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[5px] border-l-white border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent ml-0.5" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* List view */
        <div className="space-y-4">
          {posts.map((post, index) => (
            <div
              key={post.id}
              className="animate-fade-in"
              style={{ animationDelay: `${Math.min(index * 80, 400)}ms` }}
            >
              <PostCard
                post={{
                  ...post,
                  file_url: post.file_url || '',
                  file_type: post.file_type || 'image',
                  profiles: post.profiles || { display_name: isOwnProfile ? '나' : '', avatar_url: null },
                } as any}
                currentUserId={isOwnProfile ? userId : undefined}
                onDelete={() => loadPosts()}
                onUpdate={() => loadPosts()}
              />
            </div>
          ))}
        </div>
      )}

      {/* Floating upload FAB */}
      {isOwnProfile && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed bottom-24 right-5 z-40 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-dark active:scale-95 transition-all duration-200"
          aria-label="사진 올리기"
        >
          <Camera className="w-6 h-6 text-black" />
        </button>
      )}

      {/* Upload modal */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="사진 올리기"
      >
        <MultiUpload
          storagePath={`personal/${userId}`}
          onUpload={handleUpload}
        />
      </Modal>

      {/* Post detail modal (grid tap) */}
      <Modal
        isOpen={!!selectedPost}
        onClose={() => setSelectedPost(null)}
        title=""
      >
        {selectedPost && (
          <PostCard
            post={{
              ...selectedPost,
              file_url: selectedPost.file_url || '',
              file_type: selectedPost.file_type || 'image',
              file_urls: selectedPost.file_urls || [],
              profiles: selectedPost.profiles || { display_name: isOwnProfile ? '나' : '', avatar_url: null },
            }}
            currentUserId={isOwnProfile ? userId : undefined}
            onDelete={() => {
              setSelectedPost(null);
              loadPosts();
            }}
            onUpdate={() => {
              loadPosts();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
