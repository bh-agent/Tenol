'use client';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import { banUser, unbanUser } from '@/lib/actions/admin';
import { cn } from '@/lib/utils/cn';
import { Search, Ban, ShieldCheck, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';

interface AdminUserListProps {
  users: any[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

export function AdminUserList({ users, total, page, pageSize, query }: AdminUserListProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query);
  const [banModal, setBanModal] = useState<{ userId: string; name: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [acting, setActing] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    router.push(`/admin/users?${params.toString()}`);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (p > 1) params.set('page', String(p));
    router.push(`/admin/users?${params.toString()}`);
  };

  const handleBan = async () => {
    if (!banModal) return;
    setActing(true);
    try {
      await banUser(banModal.userId, banReason);
      toast.success(`${banModal.name} 정지 완료`);
      setBanModal(null);
      setBanReason('');
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '정지 실패');
    } finally {
      setActing(false);
    }
  };

  const handleUnban = async (userId: string, name: string) => {
    setActing(true);
    try {
      await unbanUser(userId);
      toast.success(`${name} 정지 해제`);
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '해제 실패');
    } finally {
      setActing(false);
    }
  };

  return (
    <>
      {/* Search */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="이름으로 검색..."
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <Button onClick={handleSearch} size="sm" variant="secondary">검색</Button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">총 {total}명</p>

      {/* User List */}
      <div className="space-y-2">
        {users.map((user: any) => (
          <Card key={user.id} padding="sm">
            <div className="flex items-center gap-3">
              <Avatar src={user.avatar_url} alt={user.display_name} fallback={user.display_name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{user.display_name}</p>
                  {user.is_admin && <Badge variant="primary" className="text-[10px]">관리자</Badge>}
                  {user.is_banned && <Badge variant="destructive" className="text-[10px]">정지</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {user.real_name || '이름 없음'} · {new Date(user.created_at).toLocaleDateString('ko-KR')}
                  {user.ntrp_level ? ` · NTRP ${user.ntrp_level}` : ''}
                </p>
                {user.banned_reason && (
                  <p className="text-[11px] text-destructive mt-0.5">사유: {user.banned_reason}</p>
                )}
              </div>
              {!user.is_admin && (
                user.is_banned ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleUnban(user.id, user.display_name)}
                    disabled={acting}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                    해제
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setBanModal({ userId: user.id, name: user.display_name })}
                    disabled={acting}
                  >
                    <Ban className="w-3.5 h-3.5 mr-1" />
                    정지
                  </Button>
                )
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">
            {page} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Ban Modal */}
      <Modal isOpen={!!banModal} onClose={() => setBanModal(null)} title="유저 정지">
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-semibold text-foreground">{banModal?.name}</span>을(를) 정지하시겠습니까?
        </p>
        <Input
          id="ban_reason"
          label="정지 사유"
          placeholder="정지 사유를 입력해주세요"
          value={banReason}
          onChange={(e) => setBanReason(e.target.value)}
        />
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" fullWidth onClick={() => setBanModal(null)}>취소</Button>
          <Button variant="destructive" fullWidth onClick={handleBan} loading={acting}>정지</Button>
        </div>
      </Modal>
    </>
  );
}
