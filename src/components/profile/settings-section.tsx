'use client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-provider';
import { createClient } from '@/lib/supabase/client';
import { unblockUser } from '@/lib/actions/moderation';
import { ChevronDown, FileText, ShieldOff, Lock } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

type BlockedUser = { id: string; name: string };

/**
 * 프로필 하단 '설정' 섹션 — 차단 사용자 관리 + 약관/개인정보 링크.
 * 차단 해제 UI와 로그인 후 약관 접근 경로가 없던 스토어 심사 리스크 해소.
 */
export function SettingsSection() {
  const toast = useToast();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [blocked, setBlocked] = useState<BlockedUser[] | null>(null); // null = 미로드
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadBlocked = async () => {
    setLoadingBlocked(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setBlocked([]); return; }
      const { data } = await supabase
        .from('user_blocks')
        .select('blocked_id, profiles:blocked_id (display_name)')
        .eq('blocker_id', user.id);
      setBlocked(
        (data || []).map((b: any) => {
          const p = Array.isArray(b.profiles) ? b.profiles[0] : b.profiles;
          return { id: b.blocked_id, name: p?.display_name || '알 수 없음' };
        }),
      );
    } catch {
      setBlocked([]);
    } finally {
      setLoadingBlocked(false);
    }
  };

  const toggleBlocked = () => {
    const next = !blockedOpen;
    setBlockedOpen(next);
    if (next && blocked === null) void loadBlocked();
  };

  const handleUnblock = async (u: BlockedUser) => {
    setUnblockingId(u.id);
    try {
      await unblockUser(u.id);
      setBlocked((prev) => (prev || []).filter((b) => b.id !== u.id));
      toast.success(`${u.name}님 차단을 해제했습니다`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '차단 해제에 실패했습니다');
    } finally {
      setUnblockingId(null);
    }
  };

  const rowClass =
    'flex items-center gap-3 w-full px-4 py-3.5 text-sm text-foreground hover:bg-surface-elevated transition-colors';

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground px-1">설정</h3>
      {/* Card와 동일 룩 — 행이 edge-to-edge여야 해서 패딩 없는 컨테이너 사용 */}
      <div className="rounded-2xl bg-card border border-border divide-y divide-border overflow-hidden">
        {/* 차단한 사용자 관리 */}
        <div>
          <button type="button" onClick={toggleBlocked} className={cn(rowClass, 'cursor-pointer')}>
            <ShieldOff className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="flex-1 text-left">차단한 사용자 관리</span>
            <ChevronDown
              className={cn('w-4 h-4 text-muted-foreground transition-transform', blockedOpen && 'rotate-180')}
            />
          </button>
          {blockedOpen && (
            <div className="px-4 pb-3 space-y-2 animate-fade-in">
              {loadingBlocked ? (
                <p className="text-xs text-muted-foreground py-2">불러오는 중...</p>
              ) : !blocked || blocked.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">차단한 사용자가 없습니다.</p>
              ) : (
                blocked.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 py-1.5"
                  >
                    <span className="flex-1 min-w-0 text-sm text-foreground truncate">{u.name}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnblock(u)}
                      disabled={unblockingId === u.id}
                    >
                      {unblockingId === u.id ? '해제 중...' : '차단 해제'}
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* 약관·개인정보 — 로그인 후에도 접근 가능해야 함 (심사 요건) */}
        <Link href="/terms" className={rowClass}>
          <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="flex-1">이용약관</span>
        </Link>
        <Link href="/privacy" className={rowClass}>
          <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="flex-1">개인정보 처리방침</span>
        </Link>
      </div>
    </div>
  );
}
