export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { AdminNav } from '@/components/admin/admin-nav';
import { requireAdmin } from '@/lib/utils/admin';
import { getClubs } from '@/lib/queries/admin';
import { AdminClubList } from '@/components/admin/admin-club-list';

export default async function AdminClubsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, page } = await searchParams;
  const pageNum = parseInt(page || '1', 10);
  const result = await getClubs(q, pageNum);

  return (
    <>
      <TopBar title="클럽 관리" backHref="/admin" />
      <AdminNav />
      <div className="px-4 animate-fade-in">
        <AdminClubList
          clubs={JSON.parse(JSON.stringify(result.clubs))}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          query={q || ''}
        />
      </div>
    </>
  );
}
