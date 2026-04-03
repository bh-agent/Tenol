'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import { removeMember, updateMemberRole, transferOwnership, updateMemberPermissions } from '@/lib/actions/clubs';
import { getPermissions, getPermissionLabel, getAllPermissions, getDefaultPermissions } from '@/lib/utils/permissions';
import type { ClubRole } from '@/types';
import type { ClubPermission } from '@/lib/utils/permissions';
import { MoreVertical, ShieldCheck, ShieldOff, UserMinus, KeyRound, Crown, X, RotateCcw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createPortal } from 'react-dom';

interface MemberManageActionsProps {
  clubId: string;
  targetUserId: string;
  currentRole: ClubRole;
  myRole: ClubRole;
  customPermissions?: string[] | null;
}

export function MemberManageActions({ clubId, targetUserId, currentRole, myRole, customPermissions }: MemberManageActionsProps) {
  const router = useRouter();
  const toast = useToast();
  const [showMenu, setShowMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [showTransferConfirm, setShowTransferConfirm] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; onConfirm: () => void } | null>(null);

  // 현재 유효 권한: 커스텀이 있으면 커스텀, 없으면 역할 기본
  const defaultPerms = getPermissions(currentRole);
  const isCustomized = customPermissions !== null && customPermissions !== undefined;
  const [editPerms, setEditPerms] = useState<string[]>(
    isCustomized ? customPermissions! : defaultPerms
  );
  const [hasChanges, setHasChanges] = useState(false);

  // 운영진은 다른 운영진을 제명할 수 없음
  const canRemove = myRole === 'owner' || (myRole === 'admin' && currentRole === 'member');

  const handleRemove = async () => {
    setConfirmAction({
      message: '정말 이 멤버를 제명하시겠습니까?',
      onConfirm: async () => {
        setLoading(true);
        try {
          await removeMember(clubId, targetUserId);
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
        } finally {
          setLoading(false);
          setShowMenu(false);
        }
      },
    });
  };

  const handleTransferOwnership = async () => {
    setLoading(true);
    try {
      await transferOwnership(clubId, targetUserId);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setLoading(false);
      setShowTransferConfirm(false);
    }
  };

  const handleRoleChange = async (newRole: string) => {
    const label = newRole === 'admin' ? '운영진' : '멤버';
    setConfirmAction({
      message: `이 멤버를 ${label}(으)로 변경하시겠습니까?`,
      onConfirm: async () => {
        setLoading(true);
        try {
          await updateMemberRole(clubId, targetUserId, newRole);
          router.refresh();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
        } finally {
          setLoading(false);
          setShowMenu(false);
        }
      },
    });
  };

  const togglePerm = (perm: ClubPermission) => {
    setEditPerms((prev) => {
      const next = prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm];
      return next;
    });
    setHasChanges(true);
  };

  const handleResetToDefault = () => {
    setEditPerms([...defaultPerms]);
    setHasChanges(true);
  };

  const handleSavePermissions = async () => {
    setPermSaving(true);
    try {
      // 현재 역할 기본값과 동일하면 null로 저장 (커스텀 해제)
      const defaultSet = new Set(defaultPerms);
      const editSet = new Set(editPerms);
      const isSameAsDefault =
        defaultSet.size === editSet.size &&
        [...defaultSet].every((p) => editSet.has(p));

      await updateMemberPermissions(clubId, targetUserId, isSameAsDefault ? null : editPerms);
      setHasChanges(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '오류가 발생했습니다');
    } finally {
      setPermSaving(false);
    }
  };

  const allPerms = getAllPermissions();
  // owner 전용 권한(club.edit)은 owner가 아닌 멤버에겐 토글 불가이므로 제외하지 않고 전체 표시
  // 단, owner만 커스텀 권한을 변경 가능
  const canEdit = myRole === 'owner';

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 rounded-full hover:bg-surface-elevated transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="멤버 관리"
          aria-haspopup="true"
          aria-expanded={showMenu}
        >
          <MoreVertical className="w-4 h-4 text-muted-foreground" />
        </button>

        {showMenu && createPortal(
          <>
            <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setShowMenu(false)} />
            <div
              className="fixed bottom-0 left-0 right-0 z-50 bg-surface-elevated rounded-t-2xl border-t border-border shadow-xl animate-slide-up safe-bottom"
              role="menu"
              aria-label="멤버 관리"
            >
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mt-3 mb-1" />
              <div className="py-1">
                {/* 회장만 운영진 승격/강등 가능 */}
                {myRole === 'owner' && currentRole === 'member' && (
                  <button
                    onClick={() => handleRoleChange('admin')}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                    role="menuitem"
                  >
                    <ShieldCheck className="w-5 h-5 text-primary" />
                    운영진으로 승격
                  </button>
                )}
                {myRole === 'owner' && currentRole === 'admin' && (
                  <button
                    onClick={() => handleRoleChange('member')}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                    role="menuitem"
                  >
                    <ShieldOff className="w-5 h-5 text-muted-foreground" />
                    멤버로 강등
                  </button>
                )}

                {/* 클럽장 양도 - 회장만 */}
                {myRole === 'owner' && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowTransferConfirm(true);
                    }}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                    role="menuitem"
                  >
                    <Crown className="w-5 h-5 text-yellow-500" />
                    클럽장 양도
                  </button>
                )}

                {/* 권한 관리 - 회장만 */}
                {myRole === 'owner' && (
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      // 모달 열 때 현재 상태로 초기화
                      setEditPerms(isCustomized ? [...customPermissions!] : [...defaultPerms]);
                      setHasChanges(false);
                      setShowPermissions(true);
                    }}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-foreground hover:bg-surface-hover transition-colors"
                    role="menuitem"
                  >
                    <KeyRound className="w-5 h-5 text-primary" />
                    권한 관리
                  </button>
                )}

                {/* 구분선 */}
                {canRemove && (
                  <div className="border-t border-border my-1" />
                )}

                {/* 제명 */}
                {canRemove && (
                  <button
                    onClick={handleRemove}
                    disabled={loading}
                    className="w-full flex items-center gap-3 px-5 py-3.5 text-sm text-destructive hover:bg-surface-hover transition-colors"
                    role="menuitem"
                  >
                    <UserMinus className="w-5 h-5" />
                    제명하기
                  </button>
                )}
              </div>
            </div>
          </>,
          document.body
        )}
      </div>

      {/* 클럽장 양도 확인 모달 */}
      {showTransferConfirm && createPortal(
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowTransferConfirm(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-sm mx-auto bg-surface-elevated rounded-2xl border border-border shadow-xl animate-fade-in">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold text-foreground">클럽장 양도</h3>
              <button
                onClick={() => setShowTransferConfirm(false)}
                className="p-1.5 rounded-full hover:bg-surface-hover transition-colors"
              >
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <Crown className="w-5 h-5 text-yellow-500 shrink-0" />
                <p className="text-sm text-foreground">
                  이 멤버에게 클럽장을 양도하면 회원님은 운영진으로 변경됩니다. 이 작업은 되돌릴 수 없습니다.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowTransferConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-surface-hover text-foreground hover:bg-muted transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={handleTransferOwnership}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-yellow-500 text-white hover:bg-yellow-600 transition-colors disabled:opacity-50"
                >
                  {loading ? '처리 중...' : '양도하기'}
                </button>
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* 확인 모달 */}
      <Modal
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title="확인"
      >
        <div className="space-y-4">
          <p className="text-sm text-foreground">{confirmAction?.message}</p>
          <div className="flex gap-2">
            <Button variant="secondary" fullWidth onClick={() => setConfirmAction(null)}>
              취소
            </Button>
            <Button
              fullWidth
              onClick={() => {
                confirmAction?.onConfirm();
                setConfirmAction(null);
              }}
            >
              확인
            </Button>
          </div>
        </div>
      </Modal>

      {/* 권한 관리 모달 */}
      {showPermissions && createPortal(
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
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Badge variant={currentRole === 'admin' ? 'success' : 'default'}>
                    {currentRole === 'admin' ? '운영진' : '멤버'}
                  </Badge>
                  {isCustomized && !hasChanges && (
                    <span className="text-[10px] text-primary font-medium px-1.5 py-0.5 bg-primary/10 rounded-full">
                      커스텀
                    </span>
                  )}
                </div>
                {canEdit && (
                  <button
                    onClick={handleResetToDefault}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    기본값
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {allPerms.map((perm) => {
                  const hasIt = editPerms.includes(perm);
                  return (
                    <div
                      key={perm}
                      className="flex items-center justify-between py-2 px-3 rounded-lg bg-background"
                    >
                      <span className="text-sm text-foreground">
                        {getPermissionLabel(perm)}
                      </span>
                      <button
                        type="button"
                        onClick={() => canEdit && togglePerm(perm)}
                        disabled={!canEdit}
                        className={`w-9 h-5 rounded-full transition-colors ${
                          hasIt ? 'bg-primary' : 'bg-muted'
                        } relative ${canEdit ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                      >
                        <div
                          className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                            hasIt ? 'translate-x-4' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>

              {canEdit && hasChanges && (
                <button
                  onClick={handleSavePermissions}
                  disabled={permSaving}
                  className="w-full py-2.5 rounded-xl text-sm font-medium bg-primary text-black hover:bg-primary-light transition-colors disabled:opacity-50 mt-2"
                >
                  {permSaving ? '저장 중...' : '권한 저장'}
                </button>
              )}

              {!canEdit && (
                <p className="text-xs text-muted-foreground pt-2">
                  권한 변경은 클럽장만 가능합니다.
                </p>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  );
}
