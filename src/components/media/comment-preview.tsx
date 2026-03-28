'use client';

import { cn } from '@/lib/utils/cn';
import Link from 'next/link';

interface LatestComment {
  id: string;
  user_id: string;
  body: string;
  profiles?: { display_name: string } | null;
}

interface CommentPreviewProps {
  mediaId: string;
  commentCount: number;
  latestComments?: LatestComment[];
  onOpenComments: () => void;
  currentUserId?: string;
}

export function CommentPreview({
  commentCount,
  latestComments,
  onOpenComments,
}: CommentPreviewProps) {
  if (commentCount === 0 && (!latestComments || latestComments.length === 0)) {
    return null;
  }

  return (
    <div className="px-1 mt-2 space-y-1.5">
      {/* "View all N comments" link */}
      {commentCount > 2 && (
        <button
          onClick={onOpenComments}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          댓글 {commentCount}개 모두 보기
        </button>
      )}

      {/* Latest 2 comments */}
      {latestComments && latestComments.length > 0 && (
        <div className="space-y-1">
          {latestComments.slice(0, 2).map((comment) => (
            <p key={comment.id} className="text-sm leading-snug truncate">
              <Link
                href={`/profile/${comment.user_id}`}
                className={cn(
                  'font-semibold text-primary hover:text-primary-light transition-colors',
                  'cursor-pointer'
                )}
              >
                {comment.profiles?.display_name ?? '사용자'}
              </Link>{' '}
              <span className="text-foreground/80">{comment.body}</span>
            </p>
          ))}
        </div>
      )}

      {/* If there are comments but no latestComments provided, show "view all" only */}
      {commentCount > 0 &&
        commentCount <= 2 &&
        (!latestComments || latestComments.length === 0) && (
          <button
            onClick={onOpenComments}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            댓글 {commentCount}개 보기
          </button>
        )}
    </div>
  );
}
