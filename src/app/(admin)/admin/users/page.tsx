export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { AdminNav } from '@/components/admin/admin-nav';
import { requireAdmin } from '@/lib/utils/admin';
import { getUsers } from '@/lib/queries/admin';
import { AdminUserList } from '@/components/admin/admin-user-list';

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  await requireAdmin();
  const { q, page } = await searchParams;
  const pageNum = parseInt(page || '1', 10);
  const result = await getUsers(q, pageNum);

  return (
    <>
      <TopBar title="유저 관리" backHref="/admin" />
      <AdminNav />
      <div className="px-4 animate-fade-in">
        <AdminUserList
          users={JSON.parse(JSON.stringify(result.users))}
          total={result.total}
          page={result.page}
          pageSize={result.pageSize}
          query={q || ''}
        />
      </div>
    </>
  );
}
