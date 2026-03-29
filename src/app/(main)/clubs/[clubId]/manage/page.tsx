export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { getPendingJoinRequests, getPendingGuestApplications } from '@/lib/queries/clubs';
import { getMyRole } from '@/lib/queries/clubs';
import { hasPermission } from '@/lib/utils/permissions';
import { notFound } from 'next/navigation';
import { ManageTabs } from './manage-tabs';

export default async function ManagePage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const myRole = await getMyRole(clubId);

  if (!hasPermission(myRole, 'member.manage')) {
    notFound();
  }

  const [joinRequests, guestApplications] = await Promise.all([
    getPendingJoinRequests(clubId),
    getPendingGuestApplications(clubId),
  ]);

  return (
    <>
      <TopBar title="신청 관리" backHref={`/clubs/${clubId}`} />

      <div className="animate-fade-in">
        <ManageTabs
          clubId={clubId}
          joinRequests={JSON.parse(JSON.stringify(joinRequests))}
          guestApplications={JSON.parse(JSON.stringify(guestApplications))}
        />
      </div>
    </>
  );
}
