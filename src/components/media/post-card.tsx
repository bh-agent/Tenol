'use client';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { ShareButton } from '@/components/ui/share-button';
import { ImageViewer } from './image-viewer';
import { LikeButton } from './like-button';
import { DoubleTapHeart } from './double-tap-heart';
import { CommentSheet } from './comment-sheet';
import { CaptionText } from './caption-text';
import { updateMedia, deleteMedia } from '@/lib/actions/media';
import { toggleLike } from '@/lib/actions/social';
import { formatRelativeTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import {
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Pencil,
  Trash2,
  MessageCircle,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useRef, useState, useTransition } from 'react';

type MediaFile = { url: string; type: string };

interface PostCardProps {
  post: {
    id: string;
    file_url: string;
    file_urls?: MediaFile[];
    file_type: string;
    caption: string | null;
    created_at: string;
    uploaded_by: string;
    like_count?: number;
    comment_count?: number;
    is_liked?: boolean;
    profiles?: { display_name: string; avatar_url: string | null };
  };
  currentUserId?: string;
  isAdmin?: boolean;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, caption: string) => void;
}

export function PostCard({ post, currentUserId, isAdmin, onDelete, onUpdate }: PostCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [liked, setLiked] = useState(post.is_liked ?? false);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const [commentSheetOpen, setCommentSheetOpen] = useState(false);
  const [, startTransition] = useTransition();

  // Touch tracking for swipe carousel
  const touchStartX = useRef(0);
  const touchDeltaX = useRef(0);

  // Build files array
  const files: MediaFile[] =
    post.file_urls && post.file_urls.length > 0
      ? post.file_urls
      : post.file_url
        ? [{ url: post.file_url, type: post.file_type || 'image' }]
        : [];

  const canManage = currentUserId === post.uploaded_by || isAdmin;
  const displayName = post.profiles?.display_name || '알 수 없음';

  const handleDelete = async () => {
    if (!confirm('이 게시물을 삭제하시겠습니까?')) return;
    setDeleting(true);
    try {
      await deleteMedia(post.id);
      setShowMenu(false);
      onDelete?.(post.id);
    } catch (e) {
      alert(e instanceof Error ? e.message : '삭제에 실패했습니다');
    } finally {
      setDeleting(false);
    }
  };

  const handleEdit = async () => {
    setSaving(true);
    try {
      await updateMedia(post.id, editCaption || null);
      setShowEdit(false);
      onUpdate?.(post.id, editCaption);
    } catch (e) {
      alert(e instanceof Error ? e.message : '수정에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const prevImage = () => setImageIndex((i) => Math.max(0, i - 1));
  const nextImage = () => setImageIndex((i) => Math.min(files.length - 1, i + 1));

  const handleDoubleTapLike = useCallback(() => {
    if (liked) return; // Already liked, just show animation
    setLiked(true);
    setLikeCount((c) => c + 1);
    startTransition(async () => {
      try {
        const result = await toggleLike(post.id);
        setLiked(result.liked);
        setLikeCount(result.likeCount);
      } catch {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    });
  }, [liked, post.id, startTransition]);

  // Swipe handlers for carousel
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const handleTouchEnd = () => {
    if (Math.abs(touchDeltaX.current) > 50) {
      if (touchDeltaX.current > 0) {
        prevImage();
      } else {
        nextImage();
      }
    }
    touchDeltaX.current = 0;
  };

  if (files.length === 0) return null;

  const captionText = post.caption || '';
  const isCaptionLong = captionText.length > 80;

  return (
    <>
      <article className="bg-surface border-b border-border">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar
            src={post.profiles?.avatar_url}
            alt={displayName}
            fallback={displayName}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <Link
              href={`/profile/${post.uploaded_by}`}
              className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block"
            >
              {displayName}
            </Link>
          </div>

          {canManage && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 -mr-2 rounded-full hover:bg-surface-elevated transition-colors"
                aria-label="더보기"
              >
                <MoreHorizontal className="w-5 h-5 text-muted-foreground" />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-10 z-50 bg-surface-elevated rounded-xl shadow-lg border border-border py-1 min-w-[140px] animate-fade-in">
                    <button
                      onClick={() => { setShowMenu(false); setShowEdit(true); }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-surface-hover transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      수정
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-surface-hover transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                      {deleting ? '삭제 중...' : '삭제'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Media Section (edge-to-edge) ── */}
        <DoubleTapHeart onDoubleTap={handleDoubleTapLike}>
          <div
            className="relative w-full overflow-hidden bg-black"
            style={{ maxHeight: '125vw' /* 4:5 aspect ratio max */ }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="relative w-full aspect-[4/5]">
              {files[imageIndex]?.type === 'video' ? (
                <video
                  src={files[imageIndex].url}
                  controls
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <button
                  onClick={() => setViewerOpen(true)}
                  className="w-full h-full cursor-zoom-in block"
                >
                  <Image
                    src={files[imageIndex]?.url || ''}
                    alt={post.caption || ''}
                    fill
                    className="object-cover"
                    sizes="100vw"
                  />
                </button>
              )}

              {/* Navigation arrows */}
              {files.length > 1 && (
                <>
                  {imageIndex > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); prevImage(); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronLeft className="w-5 h-5 text-white" />
                    </button>
                  )}
                  {imageIndex < files.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); nextImage(); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                    >
                      <ChevronRight className="w-5 h-5 text-white" />
                    </button>
                  )}

                  {/* Photo count badge */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-full">
                    {imageIndex + 1}/{files.length}
                  </div>
                </>
              )}
            </div>
          </div>
        </DoubleTapHeart>

        {/* ── Dot indicators (below media, not overlaid) ── */}
        {files.length > 1 && (
          <div className="flex justify-center gap-1.5 py-2.5">
            {files.map((_, i) => (
              <button
                key={i}
                onClick={() => setImageIndex(i)}
                className={cn(
                  'w-1.5 h-1.5 rounded-full transition-all duration-200',
                  i === imageIndex
                    ? 'bg-primary scale-125'
                    : 'bg-subtle'
                )}
              />
            ))}
          </div>
        )}

        {/* ── Action Bar ── */}
        <div className="flex items-center justify-between px-4 pt-2 pb-1">
          <div className="flex items-center gap-4">
            <LikeButton
              mediaId={post.id}
              initialLiked={liked}
              initialCount={likeCount}
              showCount={false}
              size={24}
              onLikeChange={(newLiked, newCount) => {
                setLiked(newLiked);
                setLikeCount(newCount);
              }}
            />
            <button
              onClick={() => setCommentSheetOpen(true)}
              className="hover:opacity-70 transition-opacity cursor-pointer"
              aria-label="댓글"
            >
              <MessageCircle size={24} className="text-muted-foreground" strokeWidth={1.5} />
            </button>
            <ShareButton
              url={`/feed/${post.id}`}
              title={post.caption || '테놀 게시물'}
              className="hover:opacity-70 transition-opacity cursor-pointer p-0 bg-transparent border-none"
            />
          </div>
        </div>

        {/* ── Like Count ── */}
        {likeCount > 0 && (
          <div className="px-4 pt-1">
            <span className="text-sm font-semibold text-foreground">
              좋아요 {likeCount.toLocaleString()}개
            </span>
          </div>
        )}

        {/* ── Caption Section ── */}
        {captionText && (
          <div className="px-4 pt-1.5">
            <p className={cn(
              'text-sm text-foreground leading-relaxed',
              !captionExpanded && isCaptionLong && 'line-clamp-2'
            )}>
              <Link href={`/profile/${post.uploaded_by}`} className="font-semibold mr-1.5 hover:text-primary transition-colors">{displayName}</Link>
              <CaptionText text={captionText} />
            </p>
            {isCaptionLong && !captionExpanded && (
              <button
                onClick={() => setCaptionExpanded(true)}
                className="text-sm text-muted-foreground mt-0.5 hover:text-foreground transition-colors"
              >
                더 보기
              </button>
            )}
          </div>
        )}

        {/* ── Comments Preview ── */}
        {commentCount > 0 && (
          <div className="px-4 pt-1.5">
            <button
              onClick={() => setCommentSheetOpen(true)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              댓글 {commentCount.toLocaleString()}개 모두 보기
            </button>
          </div>
        )}

        {/* ── Relative Time ── */}
        <div className="px-4 pt-2 pb-4">
          <time className="text-[11px] text-muted-foreground uppercase tracking-wide">
            {formatRelativeTime(post.created_at)}
          </time>
        </div>
      </article>

      {/* ── Fullscreen Image Viewer ── */}
      <ImageViewer
        images={files}
        initialIndex={imageIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      {/* ── Edit Modal ── */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="게시물 수정">
        <div className="space-y-4">
          <textarea
            value={editCaption}
            onChange={(e) => setEditCaption(e.target.value)}
            placeholder="설명을 입력하세요"
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-surface text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
          />
          <Button onClick={handleEdit} disabled={saving} fullWidth>
            {saving ? '저장 중...' : '저장'}
          </Button>
        </div>
      </Modal>

      {/* ── Comment Sheet ── */}
      <CommentSheet
        mediaId={post.id}
        isOpen={commentSheetOpen}
        onClose={() => setCommentSheetOpen(false)}
        commentCount={commentCount}
        currentUserId={currentUserId}
        onCommentCountChange={setCommentCount}
      />
    </>
  );
}
