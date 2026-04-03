export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { TemplateList } from '@/components/template/template-list';
import { getClubTemplates } from '@/lib/queries/templates';
import { getMyRole } from '@/lib/queries/clubs';
import { hasPermission } from '@/lib/utils/permissions';
import { getNextMatchDate } from '@/lib/utils/next-match-date';
import { redirect } from 'next/navigation';

export default async function TemplatesPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const myRole = await getMyRole(clubId);

  if (!hasPermission(myRole, 'match.create')) {
    redirect(`/clubs/${clubId}`);
  }

  const templates = await getClubTemplates(clubId);

  // Pre-calculate next match dates on server
  const templatesWithDates = templates.map((t) => ({
    ...t,
    nextMatchDate: getNextMatchDate(t.day_of_week, t.frequency_weeks, t.last_created_date),
  }));

  return (
    <>
      <TopBar title="반복 경기 템플릿" backHref={`/clubs/${clubId}`} />

      <div className="px-4 py-6 animate-fade-in">
        <TemplateList
          clubId={clubId}
          templates={JSON.parse(JSON.stringify(templatesWithDates))}
        />
      </div>
    </>
  );
}
