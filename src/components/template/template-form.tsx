'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { createTemplate } from '@/lib/actions/templates';
import { DAYS_OF_WEEK, FREQUENCY_OPTIONS, MATCH_FORMATS } from '@/lib/constants';
import { Clock, LayoutGrid, MapPin, Repeat } from 'lucide-react';
import { useTransition } from 'react';

interface TemplateFormProps {
  clubId: string;
}

export function TemplateForm({ clubId }: TemplateFormProps) {
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      await createTemplate(formData);
    });
  };

  return (
    <Card variant="glass" padding="lg">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Repeat className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">새 템플릿</h3>
          <p className="text-xs text-muted-foreground">반복 경기 정보를 입력해주세요</p>
        </div>
      </div>

      <form action={handleSubmit} className="space-y-5">
        <input type="hidden" name="club_id" value={clubId} />
        <input type="hidden" name="allow_guests" value="true" />

        <Input
          id="name"
          name="name"
          label="템플릿 이름"
          placeholder="예: 토요 정기전"
          required
        />

        <Input
          id="title_pattern"
          name="title_pattern"
          label="경기 제목 패턴"
          placeholder="예: {month}월 정기전"
          required
        />

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
            defaultValue="6"
          />
          <Select
            id="frequency_weeks"
            name="frequency_weeks"
            label="반복 주기"
            options={FREQUENCY_OPTIONS.map((f) => ({ value: String(f.value), label: f.label }))}
            defaultValue="1"
          />
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
            />
            <Input
              id="end_time"
              name="end_time"
              label="종료 시간"
              type="time"
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
            defaultValue="doubles"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              id="court_count"
              name="court_count"
              label="코트 수"
              type="number"
              min={1}
              max={20}
              defaultValue={1}
            />
            <Input
              id="max_participants"
              name="max_participants"
              label="최대 인원"
              type="number"
              min={2}
              placeholder="제한 없음"
            />
          </div>
        </div>

        <div className="pt-4">
          <Button type="submit" fullWidth size="lg" loading={isPending}>
            템플릿 만들기
          </Button>
        </div>
      </form>
    </Card>
  );
}
