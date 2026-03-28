'use client';

import { Button } from '@/components/ui/button';
import { removeMember, updateMemberRole } from '@/lib/actions/clubs';
import type { ClubRole } from '@/types';
import { MoreVertical, ShieldCheck, ShieldOff, UserMinus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface MemberManageActionsProps {
  clubId: string;
  targetUserId: string;
  currentRole: ClubRole;
  myRole: ClubRole;
}

export function MemberManageActions({ clubId, targetUserId, currentRole, myRole }: MemberManageActionsProps) {
  const router = useRouter();
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleRemove = async () => {
    if (!confirm('정말 이 멤버를 제명하시겠습니까?')) return;
    setLoading(true);
    try {
      await removeMember(clubId, targetUserId);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    setLoading(true);
    try {
      await updateMemberRole(clubId, targetUserId, newRole);
      router.refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
      setShowMenu(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="p-1.5 rounded-full hover:bg-surface-elevated transition-colors"
      >
        <MoreVertical className="w-4 h-4 text-muted-foreground" />
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-8 z-50 bg-surface-elevated rounded-xl shadow-lg border border-border py-1 min-w-[160px] animate-fade-in">
            {/* 회장만 운영진 승격/강등 가능 */}
            {myRole === 'owner' && currentRole === 'member' && (
              <button
                onClick={() => handleRoleChange('admin')}
                disabled={loading}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
              >
                <ShieldCheck className="w-4 h-4 text-primary" />
                운영진으로 변경
              </button>
            )}
            {myRole === 'owner' && currentRole === 'admin' && (
              <button
                onClick={() => handleRoleChange('member')}
                disabled={loading}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
              >
                <ShieldOff className="w-4 h-4 text-muted-foreground" />
                멤버로 변경
              </button>
            )}

            {/* 제명 */}
            <button
              onClick={handleRemove}
              disabled={loading}
              className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-surface-hover transition-colors"
            >
              <UserMinus className="w-4 h-4" />
              제명하기
            </button>
          </div>
        </>
      )}
    </div>
  );
}
