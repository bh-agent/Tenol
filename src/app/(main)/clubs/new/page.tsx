'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { TopBar } from '@/components/layout/top-bar';
import { createClub, joinClubByCode } from '@/lib/actions/clubs';
import { cn } from '@/lib/utils/cn';
import { Plus, Ticket } from 'lucide-react';
import { useState } from 'react';

export default function NewClubPage() {
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!inviteCode.trim()) {
      setError('초대 코드를 입력해주세요');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await joinClubByCode(inviteCode.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다');
      setLoading(false);
    }
  };

  return (
    <>
      <TopBar title={mode === 'create' ? '새 클럽 만들기' : '클럽 가입'} backHref="/clubs" />

      <div className="px-4 py-6 space-y-6 animate-fade-in">
        {/* Mode Toggle */}
        <div className="flex bg-surface rounded-xl p-1 border border-border">
          <button
            onClick={() => setMode('create')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer',
              mode === 'create'
                ? 'bg-primary text-black shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Plus className="w-4 h-4" />
            새로 만들기
          </button>
          <button
            onClick={() => setMode('join')}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 cursor-pointer',
              mode === 'join'
                ? 'bg-primary text-black shadow-md'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Ticket className="w-4 h-4" />
            초대 코드로 가입
          </button>
        </div>

        {mode === 'create' ? (
          <Card variant="glass" padding="lg" className="animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Plus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">클럽 만들기</h3>
                <p className="text-xs text-muted-foreground">새로운 테니스 클럽을 시작하세요</p>
              </div>
            </div>

            <form action={createClub} className="space-y-4">
              <Input
                id="name"
                name="name"
                label="클럽 이름"
                placeholder="예: 강남 테니스 클럽"
                required
              />
              <Input
                id="description"
                name="description"
                label="클럽 소개"
                placeholder="클럽에 대해 간단히 소개해주세요"
              />
              <Input
                id="region"
                name="region"
                label="활동 지역"
                placeholder="예: 서울 강남구"
              />
              <Input
                id="main_court"
                name="main_court"
                label="주요 활동 테니스장"
                placeholder="예: 올림픽공원 테니스코트"
              />
              <div className="pt-4">
                <Button type="submit" fullWidth size="lg">
                  클럽 만들기
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card variant="glass" padding="lg" className="animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Ticket className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">초대 코드로 가입</h3>
                <p className="text-xs text-muted-foreground">기존 클럽의 초대 코드를 입력하세요</p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                id="invite_code"
                label="초대 코드"
                placeholder="초대 코드를 입력해주세요"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                error={error}
              />
              <Button
                fullWidth
                size="lg"
                onClick={handleJoin}
                disabled={loading}
              >
                {loading ? '가입 중...' : '클럽 가입하기'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
