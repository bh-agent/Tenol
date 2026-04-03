export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { MatchCreateForm } from '@/components/match/match-create-form';
import { getMyRole } from '@/lib/queries/clubs';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/utils/permissions';
import { redirect } from 'next/navigation';

export default async function NewMatchPage({ params }: { params: Promise<{ clubId: string }> }) {
  const { clubId } = await params;
  const myRole = await getMyRole(clubId);

  if (!hasPermission(myRole, 'match.create')) {
    redirect(`/clubs/${clubId}`);
  }

  // Fetch club members for participant selection
  const supabase = await createClient();
  const { data: membersRaw } = await supabase
    .from('club_members')
    .select('user_id, profiles(display_name, avatar_url, ntrp_level, gender)')
    .eq('club_id', clubId);

  const members = (membersRaw || []).map((m: any) => ({
    user_id: m.user_id,
    display_name: m.profiles?.display_name || '알 수 없음',
    avatar_url: m.profiles?.avatar_url || null,
    ntrp_level: m.profiles?.ntrp_level || null,
    gender: m.profiles?.gender || null,
  }));

  return (
    <>
      <TopBar title="경기 만들기" backHref={`/clubs/${clubId}`} />
      <div className="px-4 py-6 animate-fade-in">
        <MatchCreateForm clubId={clubId} members={JSON.parse(JSON.stringify(members))} />
      </div>
    </>
  );
}
