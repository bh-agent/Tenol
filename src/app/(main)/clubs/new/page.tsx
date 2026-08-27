'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RegionPicker } from '@/components/ui/region-picker';
import { TopBar } from '@/components/layout/top-bar';
import { createClubAction, joinClubByCode } from '@/lib/actions/clubs';
import { cn } from '@/lib/utils/cn';
import { Plus, Link as LinkIcon } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/ui/toast-provider';
import { Suspense, useActionState, useState } from 'react';

function NewClubContent() {
  const searchParams = useSearchParams();
  const [mode, setMode] = useState<'create' | 'join'>(
    searchParams.get('mode') === 'join' ? 'join' : 'create'
  );
  const [inviteInput, setInviteInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [region, setRegion] = useState('');
  const router = useRouter();
  const toast = useToast();
  // 클럽 만들기 폼 — 예상 가능한 에러는 상태로 받아 인라인으로 보여줘요
  const [createState, createFormAction, createPending] = useActionState(
    createClubAction,
    null
  );

  /** Extract invite code from a link or raw code */
  const extractCode = (input: string): string => {
    const trimmed = input.trim();
    // Check if it's a full invite link
    const linkMatch = trimmed.match(/\/clubs\/join\/([A-Za-z0-9]+)\/?$/);
    if (linkMatch) return linkMatch[1];
    // Otherwise treat as raw code
    return trimmed;
  };

  const handleJoin = async () => {
    const code = extractCode(inviteInput);
    if (!code) {
      setError('초대 코드 또는 링크를 입력해주세요');
      return;
    }
    // If it looks like a full link, redirect to the join page
    if (inviteInput.trim().includes('/clubs/join/')) {
      router.push(`/clubs/join/${code}`);
      return;
    }
    setLoading(true);
    setError('');
    try {
      await joinClubByCode(code);
      // joinClubByCode는 즉시 가입이 아니라 승인 대기 신청 → 명확히 안내
      toast.success('가입 신청이 접수되었습니다. 관리자 승인 후 이용할 수 있어요.');
      router.push('/clubs');
    } catch (e) {
      setError(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
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
            <LinkIcon className="w-4 h-4" />
            초대 링크/코드로 가입
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

            <form action={createFormAction} className="space-y-4">
              <Input
                id="name"
                name="name"
                label="클럽 이름"
                placeholder="예: 강남 테니스 클럽"
                defaultValue={createState?.values.name}
                required
              />
              <Input
                id="description"
                name="description"
                label="클럽 소개"
                placeholder="클럽에 대해 간단히 소개해주세요"
                defaultValue={createState?.values.description}
              />
              <RegionPicker
                value={region}
                onChange={setRegion}
                name="region"
              />
              <Input
                id="main_court"
                name="main_court"
                label="주요 활동 테니스장"
                placeholder="예: 올림픽공원 테니스코트"
                defaultValue={createState?.values.main_court}
              />
              {createState?.error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive"
                >
                  {createState.error}
                </div>
              )}
              <div className="pt-4">
                <Button type="submit" fullWidth size="lg" loading={createPending}>
                  클럽 만들기
                </Button>
              </div>
            </form>
          </Card>
        ) : (
          <Card variant="glass" padding="lg" className="animate-fade-in">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground">초대 링크/코드로 가입</h3>
                <p className="text-xs text-muted-foreground">초대 링크 또는 코드를 입력하세요</p>
              </div>
            </div>

            <div className="space-y-4">
              <Input
                id="invite_input"
                label="초대 링크 또는 코드"
                placeholder="링크 또는 코드를 붙여넣기 하세요"
                value={inviteInput}
                onChange={(e) => setInviteInput(e.target.value)}
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

export default function NewClubPage() {
  return (
    <Suspense fallback={null}>
      <NewClubContent />
    </Suspense>
  );
}
