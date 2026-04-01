'use client';

import { MultiUpload } from '@/components/media/multi-upload';
import { PostCard } from '@/components/media/post-card';
import { Modal } from '@/components/ui/modal';
import { Skeleton } from '@/components/ui/skeleton';
import { savePersonalMedia } from '@/lib/actions/media';
import { createClient } from '@/lib/supabase/client';
import { EmptyState } from '@/components/ui/empty-state';
import { Camera, Grid3X3, List, AtSign, Heart, MessageCircle } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { cn } from '@/lib/utils/cn';

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
  is_liked?: boolean;
  profiles?: { display_name: string; avatar_url: string | null } | null;
};

type FeedTab = 'posts' | 'mentions';

export function ProfileFeed({ userId, isOwnProfile = true }: ProfileFeedProps) {
  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [mentionedPosts, setMentionedPosts] = useState<FeedItem[]>([]);
  const [mentionsLoaded, setMentionsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mentionsLoading, setMentionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<FeedTab>('posts');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedPost, setSelectedPost] = useState<FeedItem | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadPosts = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data } = await supabase
      .from('media_with_counts')
      .select(`
        id, file_url, file_urls, file_type, caption, created_at, uploaded_by, like_count, comment_count,
        profiles:uploaded_by (display_name, avatar_url)
      `)
      .eq('uploaded_by', userId)
      .eq('feed_type', 'personal')
      .order('created_at', { ascending: false });

    if (!data) { setPosts([]); setLoading(false); return; }

    // Attach is_liked status
    if (user) {
      const mediaIds = data.map((m: any) => m.id);
      const { data: likes } = await supabase
        .from('media_likes')
        .select('media_id')
        .eq('user_id', user.id)
        .in('media_id', mediaIds);

      const likedSet = new Set(likes?.map((l: any) => l.media_id) ?? []);
      setPosts(data.map((m: any) => ({ ...m, is_liked: likedSet.has(m.id) })));
    } else {
      setPosts(data.map((m: any) => ({ ...m, is_liked: false })));
    }
    setLoading(false);
  }, [userId]);

  const loadMentionedPosts = useCallback(async () => {
    setMentionsLoading(true);
    const supabase = createClient();

    // Get media IDs where user is mentioned
    const { data: mentions } = await supabase
      .from('media_mentions')
      .select('media_id')
      .eq('mentioned_user_id', userId)
      .order('created_at', { ascending: false });

    if (!mentions || mentions.length === 0) {
      setMentionedPosts([]);
      setMentionsLoading(false);
      setMentionsLoaded(true);
      return;
    }

    const mediaIds = mentions.map((m) => m.media_id);

    const { data: { user } } = await supabase.auth.getUser();

    const { data } = await supabase
      .from('media_with_counts')
      .select(`
        id, file_url, file_urls, file_type, caption, created_at, uploaded_by, like_count, comment_count,
        profiles:uploaded_by (display_name, avatar_url)
      `)
      .in('id', mediaIds)
      .order('created_at', { ascending: false });

    let normalized = (data || []).map((item: any) => ({
      ...item,
      profiles: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
      is_liked: false,
    }));

    if (user && normalized.length > 0) {
      const ids = normalized.map((m: any) => m.id);
      const { data: likes } = await supabase
        .from('media_likes')
        .select('media_id')
        .eq('user_id', user.id)
        .in('media_id', ids);

      const likedSet = new Set(likes?.map((l: any) => l.media_id) ?? []);
      normalized = normalized.map((m: any) => ({ ...m, is_liked: likedSet.has(m.id) }));
    }
    setMentionedPosts(normalized);
    setMentionsLoading(false);
    setMentionsLoaded(true);
  }, [userId]);

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  useEffect(() => {
    if (activeTab === 'mentions' && !mentionsLoaded && !mentionsLoading) {
      loadMentionedPosts();
    }
  }, [activeTab, mentionsLoaded, mentionsLoading, loadMentionedPosts]);

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

  const currentPosts = activeTab === 'posts' ? posts : mentionedPosts;
  const isCurrentLoading = activeTab === 'posts' ? loading : mentionsLoading;

  if (loading && activeTab === 'posts') {
    return (
      <div className="space-y-3">
        {/* Tab bar skeleton */}
        <div className="flex border-b border-border">
          <div className="flex-1 py-3 flex justify-center">
            <Skeleton className="w-16 h-4" />
          </div>
          <div className="flex-1 py-3 flex justify-center">
            <Skeleton className="w-16 h-4" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-[2px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      </div>
    );
  }

  const renderGrid = (items: FeedItem[]) => (
    <div className="grid grid-cols-3 gap-[2px] rounded-xl overflow-hidden">
      {items.map((post, index) => {
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
            {/* Hover overlay - Instagram style */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-200 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100">
              {(post.like_count ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-white text-sm font-semibold">
                  <Heart className="w-4 h-4 fill-white" />
                  {post.like_count}
                </span>
              )}
              {(post.comment_count ?? 0) > 0 && (
                <span className="flex items-center gap-1 text-white text-sm font-semibold">
                  <MessageCircle className="w-4 h-4 fill-white" />
                  {post.comment_count}
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
  );

  const renderList = (items: FeedItem[]) => (
    <div className="space-y-4">
      {items.map((post, index) => (
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
            onDelete={() => {
              if (activeTab === 'posts') loadPosts();
              else loadMentionedPosts();
            }}
            onUpdate={() => {
              if (activeTab === 'posts') loadPosts();
              else loadMentionedPosts();
            }}
          />
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-3 relative">
      {/* Instagram-style Tab Bar */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('posts')}
          className={cn(
            'flex-1 py-3 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors relative',
            activeTab === 'posts'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Grid3X3 className="w-4 h-4" />
          게시물
          {activeTab === 'posts' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('mentions')}
          className={cn(
            'flex-1 py-3 flex items-center justify-center gap-1.5 text-sm font-medium transition-colors relative',
            activeTab === 'mentions'
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <AtSign className="w-4 h-4" />
          언급
          {activeTab === 'mentions' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
          )}
        </button>
      </div>

      {/* View mode toggle (only show when there are posts) */}
      {currentPosts.length > 0 && (
        <div className="flex justify-end">
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
        </div>
      )}

      {/* Content */}
      {isCurrentLoading ? (
        <div className="grid grid-cols-3 gap-[2px]">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square" />
          ))}
        </div>
      ) : currentPosts.length === 0 ? (
        <EmptyState
          icon={activeTab === 'posts' ? Camera : AtSign}
          title={activeTab === 'posts' ? '아직 올린 게시물이 없어요' : '언급된 게시물이 없어요'}
          description={activeTab === 'posts' ? '테니스 일상을 공유해보세요!' : '다른 회원이 회원님을 언급하면 여기에 표시됩니다'}
        />
      ) : viewMode === 'grid' ? (
        renderGrid(currentPosts)
      ) : (
        renderList(currentPosts)
      )}

      {/* Floating upload FAB */}
      {isOwnProfile && (
        <button
          onClick={() => setShowUploadModal(true)}
          className="fixed bottom-36 right-5 z-30 w-14 h-14 bg-primary rounded-full flex items-center justify-center shadow-lg shadow-primary/30 hover:bg-primary-dark active:scale-95 transition-all duration-200"
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
              if (activeTab === 'posts') loadPosts();
              else loadMentionedPosts();
            }}
            onUpdate={() => {
              if (activeTab === 'posts') loadPosts();
              else loadMentionedPosts();
            }}
          />
        )}
      </Modal>
    </div>
  );
}
