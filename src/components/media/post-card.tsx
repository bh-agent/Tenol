'use client';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { ImageViewer } from './image-viewer';
import { updateMedia, deleteMedia } from '@/lib/actions/media';
import { ChevronLeft, ChevronRight, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';

type MediaFile = { url: string; type: string };

interface PostCardProps {
  post: {
    id: string;
    file_url: string | null;
    file_urls: MediaFile[] | null;
    file_type: string | null;
    caption: string | null;
    created_at: string;
    profiles?: { id: string; display_name: string; avatar_url: string | null } | null;
    uploaded_by?: string;
  };
  currentUserId?: string;
  isAdmin?: boolean;
  onDeleted?: () => void;
  onUpdated?: () => void;
}

export function PostCard({ post, currentUserId, isAdmin, onDeleted, onUpdated }: PostCardProps) {
  const [imageIndex, setImageIndex] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [editCaption, setEditCaption] = useState(post.caption || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // file_urls가 있으면 사용, 없으면 file_url로 폴백
  const files: MediaFile[] =
    post.file_urls && post.file_urls.length > 0
      ? post.file_urls
      : post.file_url
        ? [{ url: post.file_url, type: post.file_type || 'image' }]
        : [];

  const canManage = currentUserId === post.uploaded_by || currentUserId === (post.profiles as any)?.id || isAdmin;

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  const handleDelete = async () => {
    if (!confirm('이 게시물을 삭제하시겠습니까?')) return;
    setDeleting(true);
    try {
      await deleteMedia(post.id);
      setShowMenu(false);
      onDeleted?.();
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
      onUpdated?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : '수정에 실패했습니다');
    } finally {
      setSaving(false);
    }
  };

  const prevImage = () => setImageIndex((i) => Math.max(0, i - 1));
  const nextImage = () => setImageIndex((i) => Math.min(files.length - 1, i + 1));

  if (files.length === 0) return null;

  return (
    <>
      <Card padding="sm">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <Avatar
            src={post.profiles?.avatar_url}
            alt={post.profiles?.display_name}
            fallback={post.profiles?.display_name}
            size="sm"
          />
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{post.profiles?.display_name}</p>
            <p className="text-[10px] text-muted-foreground">{formatDate(post.created_at)}</p>
          </div>

          {canManage && (
            <div className="relative">
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="p-1.5 rounded-full hover:bg-surface-elevated transition-colors"
              >
                <MoreVertical className="w-4 h-4 text-muted-foreground" />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 top-8 z-50 bg-surface-elevated rounded-xl shadow-lg border border-border py-1 min-w-[120px] animate-fade-in">
                    <button
                      onClick={() => { setShowMenu(false); setShowEdit(true); }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                      수정
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-surface-hover transition-colors"
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

        {/* Image Carousel */}
        <div className="relative w-full aspect-square rounded-xl overflow-hidden bg-surface-elevated">
          {files[imageIndex]?.type === 'video' ? (
            <video
              src={files[imageIndex].url}
              controls
              className="w-full h-full object-cover"
            />
          ) : (
            <button
              onClick={() => setViewerOpen(true)}
              className="w-full h-full cursor-zoom-in"
            >
              <Image
                src={files[imageIndex]?.url || ''}
                alt={post.caption || ''}
                fill
                className="object-cover"
              />
            </button>
          )}

          {/* Navigation Arrows */}
          {files.length > 1 && (
            <>
              {imageIndex > 0 && (
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <ChevronLeft className="w-5 h-5 text-white" />
                </button>
              )}
              {imageIndex < files.length - 1 && (
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-black/70 transition-colors"
                >
                  <ChevronRight className="w-5 h-5 text-white" />
                </button>
              )}

              {/* Dots */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {files.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${
                      i === imageIndex ? 'bg-primary' : 'bg-white/40'
                    }`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Photo Count Badge */}
          {files.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-medium px-2 py-0.5 rounded-full">
              {imageIndex + 1}/{files.length}
            </div>
          )}
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm mt-2 text-foreground">{post.caption}</p>
        )}
      </Card>

      {/* Fullscreen Image Viewer */}
      <ImageViewer
        images={files}
        initialIndex={imageIndex}
        isOpen={viewerOpen}
        onClose={() => setViewerOpen(false)}
      />

      {/* Edit Modal */}
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
    </>
  );
}
