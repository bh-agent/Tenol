export const dynamic = 'force-dynamic';

import { TopBar } from '@/components/layout/top-bar';
import { Card } from '@/components/ui/card';
import { ClubAvatar } from '@/components/club/club-avatar';
import { BookmarkButton } from '@/components/club/bookmark-button';
import { getBookmarkedClubs } from '@/lib/queries/bookmarks';
import { MapPin, Bookmark, Search } from 'lucide-react';
import Link from 'next/link';

export default async function BookmarkedClubsPage() {
  const clubs = await getBookmarkedClubs();

  return (
    <>
      <TopBar title="즐겨찾기 클럽" backHref="/profile" />

      <div className="px-4 py-4 space-y-4 animate-fade-in">
        {/* Header */}
        <div>
          <h2 className="text-xl font-bold">
            <span className="text-gradient">즐겨찾기 클럽</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            관심 있는 클럽을 모아보세요
          </p>
        </div>

        {clubs.length === 0 ? (
          <div className="text-center py-16 space-y-4">
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <Bookmark className="w-8 h-8 text-yellow-500/60" />
              </div>
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">즐겨찾기한 클럽이 없어요</p>
              <p className="text-xs text-muted-foreground mt-1">
                클럽 탐색에서 관심 있는 클럽을 즐겨찾기해보세요
              </p>
            </div>
            <Link href="/clubs/explore">
              <div className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-primary bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-all duration-200 active:scale-[0.97]">
                <Search className="w-4 h-4" />
                클럽 탐색하기
              </div>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {clubs.length}개의 클럽
            </p>
            {clubs.map((club: any) => (
              <Card key={club.id} className="hover:border-primary/30 transition-all">
                <div className="flex items-start gap-3">
                  <Link href={`/clubs/${club.id}`}>
                    <ClubAvatar logoUrl={club.logo_url} name={club.name} size="md" />
                  </Link>
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Link href={`/clubs/${club.id}`}>
                        <h4 className="font-semibold text-foreground truncate hover:text-primary transition-colors">
                          {club.name}
                        </h4>
                      </Link>
                      <BookmarkButton clubId={club.id} initialBookmarked={true} />
                    </div>
                    {club.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {club.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {club.region && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5" />
                          {club.region}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
