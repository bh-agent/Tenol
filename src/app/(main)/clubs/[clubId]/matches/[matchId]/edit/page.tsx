'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { TopBar } from '@/components/layout/top-bar';
import { updateMatch } from '@/lib/actions/matches';
import { MATCH_FORMATS } from '@/lib/constants';
import { CalendarPlus, MapPin, Clock, LayoutGrid } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface MatchData {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  location: string | null;
  match_date: string;
  start_time: string | null;
  end_time: string | null;
  court_count: number;
  max_participants: number | null;
  format: string;
}

export default function EditMatchPage() {
  const params = useParams();
  const router = useRouter();
  const clubId = params.clubId as string;
  const matchId = params.matchId as string;

  const [match, setMatch] = useState<MatchData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMatch() {
      try {
        const supabase = createClient();
        const { data, error: fetchError } = await supabase
          .from('matches')
          .select('id, club_id, title, description, location, match_date, start_time, end_time, court_count, max_participants, format')
          .eq('id', matchId)
          .maybeSingle();

        if (fetchError || !data) {
          setError('경기를 찾을 수 없습니다');
          return;
        }

        setMatch(data);
      } catch {
        setError('경기 정보를 불러오는데 실패했습니다');
      } finally {
        setLoading(false);
      }
    }

    fetchMatch();
  }, [matchId]);

  const handleSubmit = async (formData: FormData) => {
    setSubmitting(true);
    try {
      await updateMatch(matchId, formData);
    } catch (e) {
      setError(e instanceof Error ? e.message : '경기 수정에 실패했습니다');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <>
        <TopBar title="경기 수정" backHref={`/clubs/${clubId}/matches/${matchId}`} />
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (error && !match) {
    return (
      <>
        <TopBar title="경기 수정" backHref={`/clubs/${clubId}/matches/${matchId}`} />
        <div className="px-4 py-20 text-center">
          <p className="text-muted-foreground">{error}</p>
        </div>
      </>
    );
  }

  if (!match) return null;

  return (
    <>
      <TopBar title="경기 수정" backHref={`/clubs/${clubId}/matches/${matchId}`} />

      <div className="px-4 py-6 animate-fade-in">
        <Card variant="glass" padding="lg">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <CalendarPlus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">경기 수정</h3>
              <p className="text-xs text-muted-foreground">경기 정보를 수정해주세요</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {error}
            </div>
          )}

          <form action={handleSubmit} className="space-y-5">
            <Input
              id="title"
              name="title"
              label="경기 제목"
              placeholder="예: 3월 정기 모임"
              defaultValue={match.title}
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
                defaultValue={match.match_date}
                required
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="start_time"
                  name="start_time"
                  label="시작 시간"
                  type="time"
                  defaultValue={match.start_time?.slice(0, 5) || ''}
                />
                <Input
                  id="end_time"
                  name="end_time"
                  label="종료 시간"
                  type="time"
                  defaultValue={match.end_time?.slice(0, 5) || ''}
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
                defaultValue={match.location || ''}
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
                  defaultValue={match.court_count}
                />
                <Input
                  id="max_participants"
                  name="max_participants"
                  label="최대 인원"
                  type="number"
                  min={2}
                  placeholder="제한 없음"
                  defaultValue={match.max_participants || ''}
                />
              </div>
              <Select
                id="format"
                name="format"
                label="경기 형식"
                options={[...MATCH_FORMATS]}
                defaultValue={match.format}
              />
            </div>

            <Input
              id="description"
              name="description"
              label="설명 (선택)"
              placeholder="추가 안내 사항"
              defaultValue={match.description || ''}
            />

            <div className="pt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => router.push(`/clubs/${clubId}/matches/${matchId}`)}
              >
                취소
              </Button>
              <Button type="submit" fullWidth size="lg" loading={submitting}>
                수정 완료
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
