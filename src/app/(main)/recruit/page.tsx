export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { RecruitCreateFab } from '@/components/recruitment/recruit-create-fab';
import { RecruitmentList } from '@/components/recruitment/recruitment-list';
import { getMyClubs } from '@/lib/queries/clubs';
import { searchRecruitmentPosts } from '@/lib/queries/recruitment';
import { createClient } from '@/lib/supabase/server';
import { hasPermission } from '@/lib/utils/permissions';
import type { RecruitmentType } from '@/types';

export default async function RecruitPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const { type, q } = await searchParams;
  const typeFilter = (type === 'member_recruit' || type === 'guest_recruit') ? type as RecruitmentType : undefined;

  const [posts, supabase, myClubs] = await Promise.all([
    searchRecruitmentPosts(q, typeFilter),
    createClient(),
    getMyClubs(),
  ]);

  const { data: { user } } = await supabase.auth.getUser();

  // 모집글 작성 권한(멤버 관리)이 있는 클럽만 추림
  // (getMyClubs의 Supabase 조인 타입 추론이 부정확해 any 캐스팅 — clubs/page.tsx와 동일 패턴)
  const managedClubs = (myClubs as any[])
    .filter((club) => hasPermission(club.role, 'member.manage'))
    .map((club) => ({ id: club.id as string, name: club.name as string }));

  // 이미 가입한 클럽 — 카드에서 '가입 신청' 대신 가입됨 상태를 보여주기 위함
  const myClubIds = (myClubs as any[]).map((club) => club.id as string);

  return (
    <>
      <TopBar title="모집" />

      <div className="px-4 pt-4 pb-2 animate-fade-in">
        <div className="mb-2">
          <h2 className="text-xl font-bold">
            <span className="text-gradient">모집 게시판</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            회원 모집과 게스트 모집을 찾아보세요
          </p>
        </div>
      </div>

      <RecruitmentList
        initialPosts={JSON.parse(JSON.stringify(posts))}
        initialType={typeFilter || 'all'}
        initialQuery={q || ''}
        currentUserId={user?.id}
        myClubIds={myClubIds}
      />

      <RecruitCreateFab clubs={managedClubs} />
    </>
  );
}
