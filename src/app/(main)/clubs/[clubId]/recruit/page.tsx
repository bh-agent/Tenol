export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { getClub, getMyRole } from '@/lib/queries/clubs';
import { getClubMatches } from '@/lib/queries/matches';
import { hasPermission } from '@/lib/utils/permissions';
import { notFound, redirect } from 'next/navigation';
import { RecruitmentForm } from '@/components/recruitment/recruitment-form';

export default async function CreateRecruitmentPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const [club, myRole, matches] = await Promise.all([
    getClub(clubId),
    getMyRole(clubId),
    getClubMatches(clubId),
  ]);

  if (!club) notFound();
  if (!hasPermission(myRole, 'member.manage')) {
    redirect(`/clubs/${clubId}`);
  }

  // Filter upcoming matches for the guest recruit match selector
  const upcomingMatches = matches
    .filter((m: any) => m.status === 'upcoming')
    .map((m: any) => ({
      id: m.id,
      title: m.title,
      match_date: m.match_date,
      location: m.location,
    }));

  return (
    <>
      <TopBar title="모집글 작성" backHref={`/clubs/${clubId}`} />

      <div className="px-4 pt-4 pb-32 animate-fade-in">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-foreground">{club.name}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            새 모집글을 작성하세요
          </p>
        </div>

        <RecruitmentForm
          clubId={clubId}
          upcomingMatches={JSON.parse(JSON.stringify(upcomingMatches))}
        />
      </div>
    </>
  );
}
