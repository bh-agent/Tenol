'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import { createMatchFromTemplate, deleteTemplate } from '@/lib/actions/templates';
import { isRedirectError } from '@/lib/utils/redirect-error';
import { DAYS_OF_WEEK, FREQUENCY_OPTIONS, MATCH_FORMATS } from '@/lib/constants';
import { formatDate } from '@/lib/utils/format';
import type { MatchTemplate } from '@/types';
import { Calendar, Clock, MapPin, PenLine, Plus, Repeat, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';

type TemplateWithDate = MatchTemplate & { nextMatchDate: string };

interface TemplateListProps {
  clubId: string;
  templates: TemplateWithDate[];
}

export function TemplateList({ clubId, templates }: TemplateListProps) {
  if (templates.length === 0) {
    return (
      <div className="space-y-6">
        <EmptyState clubId={clubId} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <TemplateCard key={template.id} template={template} />
      ))}

      <div className="pt-2">
        <Link href={`/clubs/${clubId}/templates/new`}>
          <Button variant="outline" fullWidth>
            <Plus className="w-4 h-4" />
            새 템플릿 추가
          </Button>
        </Link>
      </div>
    </div>
  );
}

function TemplateCard({ template }: { template: TemplateWithDate }) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isCreating, startCreating] = useTransition();
  const [isDeleting, startDeleting] = useTransition();
  const { success, error } = useToast();

  const dayLabel = DAYS_OF_WEEK.find((d) => d.value === template.day_of_week)?.label ?? '';
  const freqLabel = FREQUENCY_OPTIONS.find((f) => f.value === template.frequency_weeks)?.label ?? '';
  const formatLabel = MATCH_FORMATS.find((f) => f.value === template.format)?.label ?? '';

  const handleCreateMatch = () => {
    startCreating(async () => {
      try {
        await createMatchFromTemplate(template.id);
        success('경기가 생성되었습니다');
      } catch (e) {
        // redirect() 신호(성공 후 경기 페이지로 이동)는 다시 던져 Next가 처리하게 한다
        if (isRedirectError(e)) throw e;
        error(e instanceof Error ? e.message : '경기 생성에 실패했습니다');
      }
    });
  };

  const handleDelete = () => {
    startDeleting(async () => {
      try {
        await deleteTemplate(template.id);
        setShowDeleteModal(false);
        success('템플릿이 삭제되었습니다');
      } catch (e) {
        error(e instanceof Error ? e.message : '템플릿 삭제에 실패했습니다');
      }
    });
  };

  return (
    <>
      <Card variant="glass" padding="lg">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Repeat className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{template.name}</h3>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href={`/clubs/${template.club_id}/templates/${template.id}/edit`}
                className="p-2 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all duration-200"
              >
                <PenLine className="w-4 h-4" />
              </Link>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="p-2 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="primary">
              {freqLabel} {dayLabel}
            </Badge>
            <Badge variant="outline">{formatLabel}</Badge>
            {template.start_time && (
              <Badge variant="default">
                <Clock className="w-3 h-3 mr-1" />
                {template.start_time.slice(0, 5)}
                {template.end_time && `~${template.end_time.slice(0, 5)}`}
              </Badge>
            )}
          </div>

          {/* Location */}
          {template.location && (
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary/70" />
              {template.location}
            </div>
          )}

          {/* Next match date */}
          <div className="flex items-center gap-1.5 text-sm text-primary font-medium">
            <Calendar className="w-3.5 h-3.5" />
            다음 경기: {formatDate(template.nextMatchDate)}
          </div>

          {/* Action */}
          <div className="pt-1">
            <Button
              fullWidth
              onClick={handleCreateMatch}
              loading={isCreating}
            >
              경기 생성
            </Button>
          </div>
        </div>
      </Card>

      {/* Delete confirmation modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => !isDeleting && setShowDeleteModal(false)}
        title="템플릿 삭제"
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            &ldquo;{template.name}&rdquo; 템플릿을 삭제하시겠습니까?
            이미 생성된 경기에는 영향이 없습니다.
          </p>

          <div className="flex gap-3">
            <Button
              variant="outline"
              fullWidth
              onClick={() => setShowDeleteModal(false)}
              disabled={isDeleting}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              fullWidth
              onClick={handleDelete}
              loading={isDeleting}
            >
              삭제
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function EmptyState({ clubId }: { clubId: string }) {
  return (
    <Card variant="glass" padding="lg">
      <div className="text-center py-8 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Repeat className="w-7 h-7 text-primary/50" />
        </div>
        <div>
          <p className="text-foreground font-medium">등록된 템플릿이 없습니다</p>
          <p className="text-sm text-muted-foreground mt-1">
            반복 경기 템플릿을 만들면 매주 경기를 쉽게 생성할 수 있어요
          </p>
        </div>
        <Link href={`/clubs/${clubId}/templates/new`}>
          <Button>
            <Plus className="w-4 h-4" />
            첫 템플릿 만들기
          </Button>
        </Link>
      </div>
    </Card>
  );
}
