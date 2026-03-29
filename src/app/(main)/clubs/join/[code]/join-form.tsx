'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { joinClubByCode } from '@/lib/actions/clubs';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface JoinByLinkFormProps {
  inviteCode: string;
  profile?: {
    ntrp_level: number | null;
    tennis_start_date: string | null;
  } | null;
}

function formatTennisCareer(startDate: string | null) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const now = new Date();
  const totalMonths = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (totalMonths < 1) return '시작한 지 얼마 안 됨';
  if (totalMonths < 12) return `${totalMonths}개월`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years}년 ${months}개월` : `${years}년`;
}

export function JoinByLinkForm({ inviteCode, profile }: JoinByLinkFormProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [introduction, setIntroduction] = useState('');
  const router = useRouter();

  const handleJoin = async () => {
    setLoading(true);
    setError('');
    try {
      await joinClubByCode(inviteCode, introduction || undefined);
      setSuccess(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-3 space-y-2">
        <p className="text-sm font-medium text-primary">
          가입 신청이 완료되었습니다!
        </p>
        <p className="text-xs text-muted-foreground">
          클럽 관리자가 승인하면 알림을 보내드립니다.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push('/clubs')}
          className="mt-2"
        >
          내 클럽 목록으로
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      {/* Applicant profile info */}
      {profile && (profile.ntrp_level || profile.tennis_start_date) && (
        <div className="flex flex-wrap gap-2">
          {profile.ntrp_level && (
            <Badge variant="primary">NTRP {profile.ntrp_level}</Badge>
          )}
          {profile.tennis_start_date && (
            <Badge variant="outline">
              구력 {formatTennisCareer(profile.tennis_start_date)}
            </Badge>
          )}
        </div>
      )}

      {/* Introduction textarea */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          자기소개 <span className="text-muted-foreground font-normal">(선택)</span>
        </label>
        <textarea
          value={introduction}
          onChange={(e) => setIntroduction(e.target.value)}
          placeholder="간단한 자기소개를 작성해주세요"
          maxLength={500}
          rows={3}
          className="w-full rounded-xl border border-border bg-surface-elevated px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary resize-none"
        />
        <p className="text-xs text-muted-foreground text-right mt-1">
          {introduction.length}/500
        </p>
      </div>

      {error && (
        <p className="text-xs text-destructive text-center">{error}</p>
      )}
      <Button
        fullWidth
        size="lg"
        onClick={handleJoin}
        loading={loading}
      >
        가입 신청
      </Button>
    </div>
  );
}
