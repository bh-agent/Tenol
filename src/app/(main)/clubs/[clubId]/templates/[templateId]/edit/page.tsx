export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { TemplateForm } from '@/components/template/template-form';
import { getMyRole } from '@/lib/queries/clubs';
import { getTemplate } from '@/lib/queries/templates';
import { hasPermission } from '@/lib/utils/permissions';
import { notFound, redirect } from 'next/navigation';

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ clubId: string; templateId: string }>;
}) {
  const { clubId, templateId } = await params;
  const myRole = await getMyRole(clubId);

  if (!hasPermission(myRole, 'match.create')) {
    redirect(`/clubs/${clubId}`);
  }

  const template = await getTemplate(templateId);
  if (!template) notFound();

  return (
    <>
      <TopBar title="템플릿 수정" backHref={`/clubs/${clubId}/templates`} />
      <div className="px-4 py-6 animate-fade-in">
        <TemplateForm clubId={clubId} template={JSON.parse(JSON.stringify(template))} />
      </div>
    </>
  );
}
