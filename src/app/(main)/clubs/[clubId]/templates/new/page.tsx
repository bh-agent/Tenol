export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { TemplateForm } from '@/components/template/template-form';
import { getMyRole } from '@/lib/queries/clubs';
import { hasPermission } from '@/lib/utils/permissions';
import { redirect } from 'next/navigation';

export default async function NewTemplatePage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const myRole = await getMyRole(clubId);

  if (!hasPermission(myRole, 'match.create')) {
    redirect(`/clubs/${clubId}`);
  }

  return (
    <>
      <TopBar title="템플릿 만들기" backHref={`/clubs/${clubId}/templates`} />

      <div className="px-4 py-6 animate-fade-in">
        <TemplateForm clubId={clubId} />
      </div>
    </>
  );
}
