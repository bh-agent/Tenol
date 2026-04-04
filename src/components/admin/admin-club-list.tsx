'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/modal';
import { useToast } from '@/components/ui/toast-provider';
import { ClubAvatar } from '@/components/club/club-avatar';
import { adminDeleteClub } from '@/lib/actions/admin';
import { Search, Trash2, MapPin, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

interface AdminClubListProps {
  clubs: any[];
  total: number;
  page: number;
  pageSize: number;
  query: string;
}

export function AdminClubList({ clubs, total, page, pageSize, query }: AdminClubListProps) {
  const router = useRouter();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState(query);
  const [deleteModal, setDeleteModal] = useState<{ clubId: string; name: string } | null>(null);
  const [acting, setActing] = useState(false);

  const totalPages = Math.ceil(total / pageSize);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set('q', search.trim());
    router.push(`/admin/clubs?${params.toString()}`);
  };

  const goToPage = (p: number) => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (p > 1) params.set('page', String(p));
    router.push(`/admin/clubs?${params.toString()}`);
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setActing(true);
    try {
      await adminDeleteClub(deleteModal.clubId);
      toast.success(`${deleteModal.name} 삭제 완료`);
      setDeleteModal(null);
      startTransition(() => router.refresh());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '삭제 실패');
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
            placeholder="클럽명 검색..."
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
          />
        </div>
        <Button onClick={handleSearch} size="sm" variant="secondary">검색</Button>
      </div>

      <p className="text-xs text-muted-foreground mb-3">총 {total}개</p>

      {/* Club List */}
      <div className="space-y-2">
        {clubs.map((club: any) => (
          <Card key={club.id} padding="sm">
            <div className="flex items-center gap-3">
              <ClubAvatar logoUrl={club.logo_url} name={club.name} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-foreground truncate">{club.name}</p>
                  {!club.is_public && <Badge variant="default" className="text-[10px]">비공개</Badge>}
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                  {club.region && (
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {club.region}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5">
                    <Users className="w-3 h-3" />
                    {club.member_count}명
                  </span>
                  <span>{new Date(club.created_at).toLocaleDateString('ko-KR')}</span>
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => setDeleteModal({ clubId: club.id, name: club.name })}
                disabled={acting}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <Button size="sm" variant="secondary" onClick={() => goToPage(page - 1)} disabled={page <= 1}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button size="sm" variant="secondary" onClick={() => goToPage(page + 1)} disabled={page >= totalPages}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Delete Modal */}
      <Modal isOpen={!!deleteModal} onClose={() => setDeleteModal(null)} title="클럽 삭제">
        <p className="text-sm text-muted-foreground mb-4">
          <span className="font-semibold text-destructive">{deleteModal?.name}</span> 클럽을 삭제하시겠습니까?
          <br />
          <span className="text-xs text-destructive">이 작업은 되돌릴 수 없습니다. 모든 경기, 대진표, 멤버 데이터가 삭제됩니다.</span>
        </p>
        <div className="flex gap-2">
          <Button variant="secondary" fullWidth onClick={() => setDeleteModal(null)}>취소</Button>
          <Button variant="destructive" fullWidth onClick={handleDelete} loading={acting}>삭제</Button>
        </div>
      </Modal>
    </>
  );
}
