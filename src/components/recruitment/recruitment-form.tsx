'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils/cn';
import { createRecruitmentPost } from '@/lib/actions/recruitment';
import { useState, useTransition } from 'react';

interface UpcomingMatch {
  id: string;
  title: string;
  match_date: string;
  location: string | null;
}

interface RecruitmentFormProps {
  clubId: string;
  upcomingMatches: UpcomingMatch[];
}

export function RecruitmentForm({ clubId, upcomingMatches }: RecruitmentFormProps) {
  const [type, setType] = useState<'member_recruit' | 'guest_recruit'>('member_recruit');
  const [selectedMatchId, setSelectedMatchId] = useState('');
  const [slotMode, setSlotMode] = useState<'any' | 'gendered'>('any');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const selectedMatch = upcomingMatches.find((m) => m.id === selectedMatchId);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      try {
        await createRecruitmentPost(formData);
      } catch (e) {
        setError(e instanceof Error ? e.message : '모집글 작성에 실패했습니다');
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-5">
      <input type="hidden" name="club_id" value={clubId} />
      <input type="hidden" name="type" value={type} />

      {/* Type selector */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          모집 유형
        </label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setType('member_recruit')}
            className={cn(
              'py-3 rounded-xl text-sm font-medium transition-all duration-200 border cursor-pointer',
              type === 'member_recruit'
                ? 'bg-[#00E676]/10 border-[#00E676]/40 text-[#00E676]'
                : 'bg-surface-elevated border-border text-muted-foreground hover:border-border/80'
            )}
          >
            회원 모집
          </button>
          <button
            type="button"
            onClick={() => setType('guest_recruit')}
            className={cn(
              'py-3 rounded-xl text-sm font-medium transition-all duration-200 border cursor-pointer',
              type === 'guest_recruit'
                ? 'bg-[#42A5F5]/10 border-[#42A5F5]/40 text-[#42A5F5]'
                : 'bg-surface-elevated border-border text-muted-foreground hover:border-border/80'
            )}
          >
            게스트 모집
          </button>
        </div>
      </div>

      {/* Title */}
      <Input
        name="title"
        label="제목"
        placeholder={type === 'member_recruit' ? '예: 신규 회원을 모집합니다!' : '예: 주말 더블스 게스트 모집'}
        required
        maxLength={100}
      />

      {/* Description */}
      <div className="w-full">
        <label className="block text-sm font-medium text-muted-foreground mb-1.5">
          설명
        </label>
        <textarea
          name="description"
          placeholder="모집에 대한 상세 설명을 작성해주세요"
          rows={4}
          maxLength={1000}
          className={cn(
            'w-full px-4 py-3 rounded-xl',
            'bg-muted border border-border text-foreground',
            'placeholder:text-subtle',
            'transition-all duration-200',
            'focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50',
            'hover:border-border/80 resize-none text-sm'
          )}
        />
      </div>

      {/* Slot mode selector */}
      <div>
        <label className="block text-sm font-medium text-muted-foreground mb-2">
          모집 인원
        </label>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setSlotMode('any')}
            className={cn(
              'py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border cursor-pointer',
              slotMode === 'any'
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-surface-elevated border-border text-muted-foreground hover:border-border/80'
            )}
          >
            성별 무관
          </button>
          <button
            type="button"
            onClick={() => setSlotMode('gendered')}
            className={cn(
              'py-2.5 rounded-xl text-sm font-medium transition-all duration-200 border cursor-pointer',
              slotMode === 'gendered'
                ? 'bg-primary/10 border-primary/40 text-primary'
                : 'bg-surface-elevated border-border text-muted-foreground hover:border-border/80'
            )}
          >
            성별 지정
          </button>
        </div>
        {slotMode === 'any' ? (
          <Input
            name="any_slots"
            placeholder="모집 인원 수"
            type="number"
            min={1}
            max={100}
          />
        ) : (
          <div className="flex items-center gap-3">
            <Input
              name="male_slots"
              placeholder="남자 인원"
              type="number"
              min={0}
              max={100}
            />
            <Input
              name="female_slots"
              placeholder="여자 인원"
              type="number"
              min={0}
              max={100}
            />
          </div>
        )}
      </div>

      {/* Guest-specific fields */}
      {type === 'guest_recruit' && (
        <div className="space-y-5 p-4 rounded-xl bg-surface-elevated border border-border">
          <p className="text-sm font-medium text-[#42A5F5]">게스트 모집 정보</p>

          {/* Match selector */}
          {upcomingMatches.length > 0 && (
            <Select
              name="match_id"
              label="경기 선택 (선택사항)"
              placeholder="경기를 선택하세요"
              value={selectedMatchId}
              onChange={(e) => setSelectedMatchId(e.target.value)}
              options={upcomingMatches.map((m) => ({
                value: m.id,
                label: `${m.title} (${m.match_date})`,
              }))}
            />
          )}

          {/* Match date */}
          <Input
            name="match_date"
            label="경기 날짜"
            type="date"
            defaultValue={selectedMatch?.match_date || ''}
          />

          {/* Location */}
          <Input
            name="location"
            label="장소"
            placeholder="경기 장소를 입력하세요"
            defaultValue={selectedMatch?.location || ''}
            maxLength={200}
          />

          {/* NTRP range */}
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">
              NTRP 범위 (선택사항)
            </label>
            <div className="flex items-center gap-3">
              <Input
                name="ntrp_min"
                type="number"
                placeholder="최소"
                min={1.0}
                max={7.0}
                step={0.5}
              />
              <span className="text-muted-foreground">~</span>
              <Input
                name="ntrp_max"
                type="number"
                placeholder="최대"
                min={1.0}
                max={7.0}
                step={0.5}
              />
            </div>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}

      <Button type="submit" fullWidth loading={isPending}>
        게시하기
      </Button>
    </form>
  );
}
