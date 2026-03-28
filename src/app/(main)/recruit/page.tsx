export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { RecruitmentList } from '@/components/recruitment/recruitment-list';
import { searchRecruitmentPosts } from '@/lib/queries/recruitment';
import { createClient } from '@/lib/supabase/server';
import type { RecruitmentType } from '@/types';

export default async function RecruitPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>;
}) {
  const { type, q } = await searchParams;
  const typeFilter = (type === 'member_recruit' || type === 'guest_recruit') ? type as RecruitmentType : undefined;

  const [posts, supabase] = await Promise.all([
    searchRecruitmentPosts(q, typeFilter),
    createClient(),
  ]);

  const { data: { user } } = await supabase.auth.getUser();

  return (
    <>
      <TopBar title="모집" backHref="/clubs/explore" />

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
      />
    </>
  );
}
