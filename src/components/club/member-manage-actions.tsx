'use client';

import { Badge } from '@/components/ui/badge';
import { removeMember, updateMemberRole } from '@/lib/actions/clubs';
import { getPermissions, getPermissionLabel } from '@/lib/utils/permissions';
import type { ClubRole } from '@/types';
import type { ClubPermission } from '@/lib/utils/permissions';
import { MoreVertical, ShieldCheck, ShieldOff, UserMinus, KeyRound, X } from 'lucide-react';
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
  const [showPermissions, setShowPermissions] = useState(false);

  // 운영진은 다른 운영진을 제명할 수 없음
  const canRemove = myRole === 'owner' || (myRole === 'admin' && currentRole === 'member');

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
    const label = newRole === 'admin' ? '운영진' : '멤버';
    if (!confirm(`이 멤버를 ${label}(으)로 변경하시겠습니까?`)) return;
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

  const permissions = getPermissions(currentRole);

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 rounded-full hover:bg-surface-elevated transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-8 z-50 bg-surface-elevated rounded-xl shadow-lg border border-border py-1 min-w-[180px] animate-fade-in">
              {/* 회장만 운영진 승격/강등 가능 */}
              {myRole === 'owner' && currentRole === 'member' && (
                <button
                  onClick={() => handleRoleChange('admin')}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                >
                  <ShieldCheck className="w-4 h-4 text-primary" />
                  운영진으로 승격
                </button>
              )}
              {myRole === 'owner' && currentRole === 'admin' && (
                <button
                  onClick={() => handleRoleChange('member')}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                >
                  <ShieldOff className="w-4 h-4 text-muted-foreground" />
                  멤버로 강등
                </button>
              )}

              {/* 권한 관리 - 회장만 */}
              {myRole === 'owner' && (
                <button
                  onClick={() => {
                    setShowMenu(false);
                    setShowPermissions(true);
                  }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                >
                  <KeyRound className="w-4 h-4 text-primary" />
                  권한 관리
                </button>
              )}

              {/* 구분선 */}
              {canRemove && (
                <div className="border-t border-border my-1" />
              )}

              {/* 제명 - 운영진은 일반 멤버만 제명 가능 */}
              {canRemove && (
                <button
                  onClick={handleRemove}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-destructive hover:bg-surface-hover transition-colors"
                >
                  <UserMinus className="w-4 h-4" />
                  제명하기
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* 권한 관리 모달 */}
      {showPermissions && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowPermissions(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-surface-elevated rounded-2xl border border-border shadow-xl animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">권한 관리</h3>
              <button
                onClick={() => setShowPermissions(false)}
                className="p-1.5 rounded-full hover:bg-surface-hover transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-3">
                <Badge variant={currentRole === 'admin' ? 'success' : 'default'}>
                  {currentRole === 'admin' ? '운영진' : '멤버'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  역할 기반 권한
                </span>
              </div>

              <div className="space-y-2">
                {(['club.edit', 'member.manage', 'match.create', 'draw.manage', 'result.input', 'media.upload', 'guest.manage'] as ClubPermission[]).map((perm) => {
                  const hasIt = permissions.includes(perm);
                  return (
                    <div
                      key={perm}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-background"
                    >
                      <span className="text-sm text-foreground">
                        {getPermissionLabel(perm)}
                      </span>
                      <div
                        className={`w-9 h-5 rounded-full transition-colors ${
                          hasIt ? 'bg-primary' : 'bg-muted'
                        } relative cursor-not-allowed`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            hasIt ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <p className="text-xs text-muted-foreground pt-2">
                현재 권한은 역할에 따라 자동으로 부여됩니다. 역할을 변경하려면 메뉴에서 승격/강등을 사용하세요.
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
