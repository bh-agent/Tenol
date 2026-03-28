'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TopBar } from '@/components/layout/top-bar';
import { createMatch } from '@/lib/actions/matches';
import { MATCH_FORMATS } from '@/lib/constants';
import { CalendarPlus, MapPin, Clock, LayoutGrid } from 'lucide-react';
import { useParams } from 'next/navigation';

export default function NewMatchPage() {
  const params = useParams();
  const clubId = params.clubId as string;

  return (
    <>
      <TopBar title="경기 만들기" backHref={`/clubs/${clubId}`} />

      <div className="px-4 py-6 animate-fade-in">
        <Card variant="glass" padding="lg">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">새 경기</h3>
              <p className="text-xs text-muted-foreground">경기 정보를 입력해주세요</p>
            </div>
          </div>

          <form action={createMatch} className="space-y-5">
            <input type="hidden" name="club_id" value={clubId} />

            <Input
              id="title"
              name="title"
              label="경기 제목"
              placeholder="예: 3월 정기 모임"
              required
            />

            {/* Date & Time section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="w-4 h-4 text-primary/70" />
                <span className="font-medium">일시</span>
              </div>
              <Input
                id="match_date"
                name="match_date"
                label="날짜"
                type="date"
                required
              />
              <div className="grid grid-cols-2 gap-3">
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

            {/* Court & participants section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <LayoutGrid className="w-4 h-4 text-primary/70" />
                <span className="font-medium">경기 설정</span>
              </div>
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
              <Select
                id="format"
                name="format"
                label="경기 형식"
                options={[...MATCH_FORMATS]}
                defaultValue="doubles"
              />
            </div>

            <Input
              id="description"
              name="description"
              label="설명 (선택)"
              placeholder="추가 안내 사항"
            />

            <div className="pt-4">
              <Button type="submit" fullWidth size="lg">
                경기 만들기
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
