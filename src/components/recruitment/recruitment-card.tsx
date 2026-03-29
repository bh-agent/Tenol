'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatRelativeTime, formatDate } from '@/lib/utils/format';
import type { RecruitmentPost } from '@/types';
import {
  MapPin,
  Calendar,
  Users,
  MoreHorizontal,
  X,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { closeRecruitmentPost, deleteRecruitmentPost } from '@/lib/actions/recruitment';

interface RecruitmentCardProps {
  post: RecruitmentPost;
  currentUserId?: string;
  onClose?: (id: string) => void;
  onDelete?: (id: string) => void;
}

function formatSlots(post: RecruitmentPost): string | null {
  if (post.male_slots != null || post.female_slots != null) {
    const parts: string[] = [];
    if (post.male_slots != null && post.male_slots > 0) parts.push(`남 ${post.male_slots}명`);
    if (post.female_slots != null && post.female_slots > 0) parts.push(`여 ${post.female_slots}명`);
    return parts.join(' / ') || null;
  }
  if (post.any_slots != null) return `성별 무관 ${post.any_slots}명`;
  if (post.needed_count != null) return `${post.needed_count}명 모집`;
  return null;
}

export function RecruitmentCard({ post, currentUserId, onClose, onDelete }: RecruitmentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [closing, startClosing] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const isMemberRecruit = post.type === 'member_recruit';
  const isOwner = currentUserId === post.created_by;
  const clubName = post.clubs?.name || '알 수 없음';
  const creatorName = post.profiles?.display_name || '알 수 없음';
  const description = post.description || '';
  const isDescriptionLong = description.length > 120;

  const handleClose = () => {
    startClosing(async () => {
      try {
        await closeRecruitmentPost(post.id);
        setShowMenu(false);
        onClose?.(post.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : '마감에 실패했습니다');
      }
    });
  };

  const handleDelete = () => {
    if (!confirm('이 모집글을 삭제하시겠습니까?')) return;
    startDeleting(async () => {
      try {
        await deleteRecruitmentPost(post.id);
        setShowMenu(false);
        onDelete?.(post.id);
      } catch (e) {
        alert(e instanceof Error ? e.message : '삭제에 실패했습니다');
      }
    });
  };

  return (
    <article
      className={cn(
        'bg-card rounded-2xl border overflow-hidden transition-all duration-200',
        isMemberRecruit
          ? 'border-l-[3px] border-l-[#00E676] border-t-border border-r-border border-b-border'
          : 'border-l-[3px] border-l-[#42A5F5] border-t-border border-r-border border-b-border'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <Link href={`/clubs/${post.club_id}`}>
          <Avatar
            src={post.clubs?.logo_url}
            alt={clubName}
            fallback={clubName}
            size="sm"
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Link
              href={`/clubs/${post.club_id}`}
              className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate"
            >
              {clubName}
            </Link>
            <Badge
              variant={isMemberRecruit ? 'success' : 'primary'}
              className={cn(
                'text-[10px] flex-shrink-0',
                !isMemberRecruit && 'bg-[#42A5F5]/10 text-[#42A5F5] border-[#42A5F5]/20'
              )}
            >
              {isMemberRecruit ? '회원 모집' : '게스트 모집'}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {creatorName} · {formatRelativeTime(post.created_at)}
          </p>
        </div>

        {isOwner && (
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
                    onClick={handleClose}
                    disabled={closing}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-surface-hover transition-colors"
                  >
                    <X className="w-4 h-4" />
                    {closing ? '마감 중...' : '모집 마감'}
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

      {/* Title */}
      <div className="px-4 pb-2">
        <h3 className="text-base font-bold text-foreground leading-snug">{post.title}</h3>
      </div>

      {/* Guest-specific info */}
      {!isMemberRecruit && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {post.match_date && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-xs text-muted-foreground">
              <Calendar className="w-3 h-3 text-[#42A5F5]/70" />
              {formatDate(post.match_date)}
            </span>
          )}
          {post.location && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 text-[#42A5F5]/70" />
              {post.location}
            </span>
          )}
          {formatSlots(post) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-xs text-muted-foreground">
              <Users className="w-3 h-3 text-[#42A5F5]/70" />
              {formatSlots(post)}
            </span>
          )}
          {(post.ntrp_min || post.ntrp_max) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-xs text-muted-foreground">
              NTRP {post.ntrp_min ?? '?'} ~ {post.ntrp_max ?? '?'}
            </span>
          )}
        </div>
      )}

      {/* Member recruit info */}
      {isMemberRecruit && (post.clubs?.region || formatSlots(post)) && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {post.clubs?.region && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-xs text-muted-foreground">
              <MapPin className="w-3 h-3 text-[#00E676]/70" />
              {post.clubs.region}
            </span>
          )}
          {formatSlots(post) && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-elevated border border-border text-xs text-muted-foreground">
              <Users className="w-3 h-3 text-[#00E676]/70" />
              {formatSlots(post)}
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {description && (
        <div className="px-4 pb-3">
          <p
            className={cn(
              'text-sm text-muted-foreground leading-relaxed',
              !expanded && isDescriptionLong && 'line-clamp-3'
            )}
          >
            {description}
          </p>
          {isDescriptionLong && !expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-sm text-primary mt-0.5 hover:underline"
            >
              더 보기
            </button>
          )}
        </div>
      )}

      {/* Action Button */}
      <div className="px-4 pb-4">
        {isMemberRecruit ? (
          <Link href={`/clubs/${post.club_id}`}>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              className="border-[#00E676]/30 text-[#00E676] hover:bg-[#00E676]/10 hover:border-[#00E676]/50"
            >
              가입 신청
            </Button>
          </Link>
        ) : (
          <Link href={post.match_id ? `/clubs/${post.club_id}/matches/${post.match_id}` : `/clubs/${post.club_id}`}>
            <Button
              variant="outline"
              size="sm"
              fullWidth
              className="border-[#42A5F5]/30 text-[#42A5F5] hover:bg-[#42A5F5]/10 hover:border-[#42A5F5]/50"
            >
              게스트 신청
            </Button>
          </Link>
        )}
      </div>
    </article>
  );
}
