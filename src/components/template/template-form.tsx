'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createTemplate, updateTemplate } from '@/lib/actions/templates';
import { DAYS_OF_WEEK, FREQUENCY_OPTIONS, MATCH_FORMATS } from '@/lib/constants';
import { resolveTitle, getUpcomingDates } from '@/lib/utils/next-match-date';
import type { TitleFormat } from '@/lib/utils/next-match-date';
import type { MatchTemplate } from '@/types';
import { Calendar, Clock, LayoutGrid, MapPin, Repeat } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';

const TITLE_FORMAT_OPTIONS = [
  { value: 'with_date', label: '이름 + 날짜', description: '토요 정기전 (4/5)' },
  { value: 'with_round', label: '이름 + 회차', description: '토요 정기전 4월 1회차' },
  { value: 'name_only', label: '이름만', description: '토요 정기전' },
];

interface TemplateFormProps {
  clubId: string;
  template?: MatchTemplate;
}

export function TemplateForm({ clubId, template }: TemplateFormProps) {
  const isEdit = !!template;
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(template?.name || '');
  const [titleFormat, setTitleFormat] = useState<TitleFormat>(template?.title_format || 'with_date');
  const [dayOfWeek, setDayOfWeek] = useState(String(template?.day_of_week ?? 6));
  const [frequencyWeeks, setFrequencyWeeks] = useState(String(template?.frequency_weeks ?? 1));

  // Preview upcoming dates and titles
  const previewDates = useMemo(() => {
    return getUpcomingDates(Number(dayOfWeek), Number(frequencyWeeks), 4);
  }, [dayOfWeek, frequencyWeeks]);

  const previewTitles = useMemo(() => {
    const baseName = name.trim() || '정기전';
    return previewDates.map((dateStr, i) =>
      resolveTitle(baseName, dateStr, titleFormat, i + 1)
    );
  }, [name, titleFormat, previewDates]);

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      if (isEdit) {
        await updateTemplate(formData);
      } else {
        await createTemplate(formData);
      }
    });
  };

  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <Card variant="glass" padding="lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Repeat className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">{isEdit ? '템플릿 수정' : '새 템플릿'}</h3>
          <p className="text-xs text-muted-foreground">반복 경기 정보를 입력해주세요</p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-5">
        <input type="hidden" name="club_id" value={clubId} />
        <input type="hidden" name="allow_guests" value="true" />
        {isEdit && <input type="hidden" name="id" value={template.id} />}

        <Input
          id="name"
          name="name"
          label="경기 이름"
          placeholder="예: 토요 정기전"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        {/* Title format */}
        <div>
          <Select
            id="title_format"
            name="title_format"
            label="제목 생성 방식"
            options={TITLE_FORMAT_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} — ${o.description}` }))}
            value={titleFormat}
            onChange={(e) => setTitleFormat(e.target.value as TitleFormat)}
          />
        </div>

        {/* Schedule section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Repeat className="w-4 h-4 text-primary/70" />
            <span className="font-medium">반복 설정</span>
          </div>
          <Select
            id="day_of_week"
            name="day_of_week"
            label="반복 요일"
            options={DAYS_OF_WEEK.map((d) => ({ value: String(d.value), label: d.label }))}
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
          />
          <Select
            id="frequency_weeks"
            name="frequency_weeks"
            label="반복 주기"
            options={FREQUENCY_OPTIONS.map((f) => ({ value: String(f.value), label: f.label }))}
            value={frequencyWeeks}
            onChange={(e) => setFrequencyWeeks(e.target.value)}
          />
        </div>

        {/* Preview */}
        <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Calendar className="w-3.5 h-3.5 text-primary/70" />
            다음 경기 미리보기
          </div>
          {previewDates.map((dateStr, i) => {
            const d = new Date(dateStr + 'T00:00:00');
            return (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{previewTitles[i]}</span>
                <Badge variant="default" className="text-[11px]">
                  {d.getMonth() + 1}/{d.getDate()} ({weekdays[d.getDay()]})
                </Badge>
              </div>
            );
          })}
        </div>

        {/* Time section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="w-4 h-4 text-primary/70" />
            <span className="font-medium">시간</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              id="start_time"
              name="start_time"
              label="시작 시간"
              type="time"
              defaultValue={template?.start_time?.slice(0, 5) || ''}
            />
            <Input
              id="end_time"
              name="end_time"
              label="종료 시간"
              type="time"
              defaultValue={template?.end_time?.slice(0, 5) || ''}
            />
          </div>
        </div>

        {/* Location section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 text-primary/70" />
            <span className="font-medium">장소</span>
          </div>
          <Input
            id="location"
            name="location"
            label="장소"
            placeholder="예: 올림픽공원 테니스코트"
            defaultValue={template?.location || ''}
          />
        </div>

        {/* Match settings section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LayoutGrid className="w-4 h-4 text-primary/70" />
            <span className="font-medium">경기 설정</span>
          </div>
          <Select
            id="format"
            name="format"
            label="경기 형식"
            options={[...MATCH_FORMATS]}
            defaultValue={template?.format || 'doubles'}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="court_count"
              name="court_count"
              label="코트 수"
              type="number"
              min={1}
              max={20}
              defaultValue={template?.court_count ?? 1}
            />
            <Input
              id="max_participants"
              name="max_participants"
              label="최대 인원"
              type="number"
              min={2}
              placeholder="제한 없음"
              defaultValue={template?.max_participants ?? ''}
            />
          </div>
        </div>

        <Input
          id="description"
          name="description"
          label="설명 (선택)"
          placeholder="추가 안내 사항"
          defaultValue={template?.description || ''}
        />

        <div className="pt-4">
          <Button type="submit" fullWidth size="lg" loading={isPending}>
            {isEdit ? '템플릿 수정' : '템플릿 만들기'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
