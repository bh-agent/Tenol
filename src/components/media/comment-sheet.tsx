'use client';

import { Avatar } from '@/components/ui/avatar';
import { CaptionText } from '@/components/media/caption-text';
import { MentionAutocomplete } from '@/components/media/mention-autocomplete';
import { useMentionInput } from '@/lib/hooks/use-mention-input';
import { cn } from '@/lib/utils/cn';
import { createClient } from '@/lib/supabase/client';
import { addComment, deleteComment } from '@/lib/actions/social';
import { formatRelativeTime } from '@/lib/utils/format';
import { Send, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

interface Comment {
  id: string;
  media_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null } | null;
}

interface CommentSheetProps {
  mediaId: string;
  isOpen: boolean;
  onClose: () => void;
  commentCount: number;
  currentUserId?: string;
  onCommentCountChange?: (count: number) => void;
}

export function CommentSheet({
  mediaId,
  isOpen,
  onClose,
  commentCount,
  currentUserId,
  onCommentCountChange,
}: CommentSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  const mention = useMentionInput(inputRef, setBody);

  // Drag-to-dismiss state
  const dragStartY = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // ---------- mount / animate ----------
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
    } else {
      setVisible(false);
      document.body.style.overflow = '';
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // ---------- fetch comments ----------
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('media_comments')
        .select(
          'id, media_id, user_id, body, created_at, profiles:user_id (display_name, avatar_url)'
        )
        .eq('media_id', mediaId)
        .order('created_at', { ascending: false });
      const fetched = (data as unknown as Comment[]) ?? [];
      setComments(fetched);
      onCommentCountChange?.(fetched.length);
    } finally {
      setLoading(false);
    }
  }, [mediaId, onCommentCountChange]);

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      // Focus input after animation
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [isOpen, fetchComments]);

  // ---------- add comment ----------
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || submitting || !currentUserId) return;

    setSubmitting(true);

    // Optimistic insert
    const optimistic: Comment = {
      id: `temp-${Date.now()}`,
      media_id: mediaId,
      user_id: currentUserId,
      body: trimmed,
      created_at: new Date().toISOString(),
      profiles: null, // will show fallback avatar
    };
    setComments((prev) => [optimistic, ...prev]);
    setBody('');

    try {
      await addComment(mediaId, trimmed);
      // Re-fetch to get real IDs and profile info
      await fetchComments();
    } catch {
      // Revert optimistic on failure
      setComments((prev) => prev.filter((c) => c.id !== optimistic.id));
      setBody(trimmed);
    } finally {
      setSubmitting(false);
    }
  };

  // ---------- delete comment ----------
  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);

    // Optimistic remove
    const prev = comments;
    const updated = comments.filter((x) => x.id !== commentId);
    setComments(updated);
    onCommentCountChange?.(updated.length);

    try {
      await deleteComment(commentId);
    } catch {
      setComments(prev);
      onCommentCountChange?.(prev.length);
    } finally {
      setDeletingId(null);
    }
  };

  // ---------- drag-to-dismiss ----------
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only from drag handle area (top 40px)
    const rect = sheetRef.current?.getBoundingClientRect();
    if (!rect) return;
    if (e.touches[0].clientY - rect.top > 48) return;
    dragStartY.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) setDragOffset(dy);
  };

  const handleTouchEnd = () => {
    if (dragOffset > 120) {
      onClose();
    }
    setDragOffset(0);
    dragStartY.current = null;
  };

  if (!mounted) return null;

  const displayCount = comments.length || commentCount;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-0 flex items-end pointer-events-none">
        <div
          ref={sheetRef}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={
            dragOffset > 0
              ? { transform: `translateY(${dragOffset}px)`, transition: 'none' }
              : undefined
          }
          className={cn(
            'pointer-events-auto relative z-50 w-full flex flex-col',
            'bg-surface border-t border-white/[0.06]',
            'max-h-[80vh] rounded-t-2xl',
            'sm:max-w-lg sm:mx-auto',
            'transition-all duration-300 ease-out',
            visible
              ? 'translate-y-0 opacity-100'
              : 'translate-y-full opacity-0'
          )}
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-subtle" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
            <h2 className="text-base font-semibold text-foreground">
              댓글{' '}
              <span className="text-muted-foreground font-normal">
                {displayCount}
              </span>
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition-all duration-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Comment list */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto overscroll-contain px-5 py-3"
          >
            {loading && comments.length === 0 ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3 animate-pulse">
                    <div className="w-8 h-8 rounded-full bg-surface-elevated flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-20 bg-surface-elevated rounded" />
                      <div className="h-3 w-40 bg-surface-elevated rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground text-sm">
                <p>아직 댓글이 없습니다</p>
                <p className="text-xs mt-1">첫 번째 댓글을 남겨보세요!</p>
              </div>
            ) : (
              <div className="space-y-4 stagger">
                {comments.map((comment) => (
                  <div key={comment.id} className="flex gap-3 group">
                    <Avatar
                      src={comment.profiles?.avatar_url}
                      alt={comment.profiles?.display_name}
                      fallback={comment.profiles?.display_name}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <Link
                          href={`/profile/${comment.user_id}`}
                          className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
                        >
                          {comment.profiles?.display_name ?? '사용자'}
                        </Link>
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatRelativeTime(comment.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/90 mt-0.5 break-words">
                        <CaptionText text={comment.body} />
                      </p>
                    </div>
                    {/* Delete button for own comments */}
                    {currentUserId === comment.user_id && (
                      <button
                        onClick={() => handleDelete(comment.id)}
                        disabled={deletingId === comment.id}
                        className={cn(
                          'self-center p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200',
                          'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
                          'sm:opacity-0 sm:group-hover:opacity-100',
                          // Always show on mobile via active state
                          'active:opacity-100'
                        )}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Input bar */}
          {currentUserId && (
            <form
              onSubmit={handleSubmit}
              className="relative flex items-center gap-3 px-4 py-3 border-t border-border safe-bottom bg-surface"
            >
              <MentionAutocomplete
                query={mention.autocompleteQuery}
                isOpen={mention.isAutocompleteOpen}
                onSelect={mention.handleSelect}
                onClose={mention.handleClose}
                position="above"
              />
              <Avatar
                size="sm"
                fallback="나"
                className="flex-shrink-0"
              />
              <input
                ref={inputRef}
                type="text"
                value={body}
                onChange={(e) => {
                  setBody(e.target.value);
                  mention.handleInputChange(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (mention.handleKeyDown(e)) {
                    e.preventDefault();
                  }
                }}
                placeholder="댓글 달기..."
                className="flex-1 min-w-0 bg-surface-elevated text-sm text-foreground placeholder:text-muted-foreground rounded-full px-4 py-2.5 border border-border focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
              <button
                type="submit"
                disabled={!body.trim() || submitting}
                className={cn(
                  'p-2 rounded-full transition-all duration-200 flex-shrink-0 cursor-pointer',
                  body.trim()
                    ? 'bg-primary text-background hover:bg-primary-dark'
                    : 'bg-surface-elevated text-muted-foreground cursor-not-allowed'
                )}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
