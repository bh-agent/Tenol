export const dynamic = 'force-dynamic';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TopBar } from '@/components/layout/top-bar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { getMyClubs } from '@/lib/queries/clubs';
import { formatRole } from '@/lib/utils/format';
import { Users, Plus, MapPin, Search, Link2 as LinkIcon } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { ClubAvatar } from '@/components/club/club-avatar';

export default async function ClubsPage() {
  const clubs = await getMyClubs();

  return (
    <>
      <TopBar
        title="내 클럽"
        rightAction={
          <div className="flex items-center gap-1">
            <Suspense fallback={null}>
              <NotificationBell />
            </Suspense>
            <Link
              href="/clubs/explore"
              className="p-2 rounded-full hover:bg-surface-elevated transition-colors"
              aria-label="클럽 탐색"
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>
        }
      />

      <div className="px-4 py-5 animate-fade-in">
        {/* Section header */}
        <div className="mb-4">
          <h2 className="text-xl font-bold text-foreground">
            <span className="text-gradient">내 클럽</span>
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {clubs.length > 0 ? `${clubs.length}개의 클럽에 가입됨` : '클럽에 가입해보세요'}
          </p>
        </div>

        {clubs.length === 0 ? (
          <div className="space-y-4">
            <EmptyState
              icon={Users}
              title="아직 가입한 클럽이 없어요"
              description="클럽을 만들어 경기를 관리하거나, 기존 클럽에 가입해보세요"
              actionLabel="새 클럽 만들기"
              actionHref="/clubs/new"
            />
            <div className="grid grid-cols-2 gap-3">
              <Link href="/clubs/explore">
                <Card variant="default" className="text-center py-6 hover:border-primary/30 transition-all active:scale-[0.97]">
                  <Search className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">클럽 탐색하기</p>
                  <p className="text-xs text-muted-foreground mt-0.5">공개 클럽 찾기</p>
                </Card>
              </Link>
              <Link href="/clubs/new?mode=join">
                <Card variant="default" className="text-center py-6 hover:border-primary/30 transition-all active:scale-[0.97]">
                  <LinkIcon className="w-6 h-6 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">초대코드로 가입</p>
                  <p className="text-xs text-muted-foreground mt-0.5">링크/코드 입력</p>
                </Card>
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3 stagger">
            {clubs.map((club: any) => (
              <Link key={club.id} href={`/clubs/${club.id}`}>
                <Card
                  variant="glow"
                  className="hover:shadow-[0_0_24px_rgba(0,230,118,0.15)] active:scale-[0.98] transition-all duration-300"
                >
                  <div className="flex items-start gap-3.5">
                    <ClubAvatar logoUrl={club.logo_url} name={club.name} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-foreground truncate">{club.name}</h3>
                        <Badge variant="primary">{formatRole(club.role)}</Badge>
                      </div>
                      {club.region && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3.5 h-3.5 text-primary/60" />
                          {club.region}
                        </p>
                      )}
                      {club.description && (
                        <p className="text-sm text-subtle mt-1 line-clamp-1">
                          {club.description}
                        </p>
                      )}
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* FAB for creating club */}
      <Link
        href="/clubs/new"
        aria-label="새 클럽 만들기"
        className="hide-on-keyboard fixed right-5 z-30 w-14 h-14 rounded-full bg-primary text-black flex items-center justify-center shadow-lg shadow-primary/30 hover:shadow-[0_0_30px_rgba(0,230,118,0.35)] transition-all duration-300 active:scale-90"
        style={{ bottom: 'calc(88px + env(safe-area-inset-bottom))' }}
      >
        <Plus className="w-6 h-6" strokeWidth={2.4} />
      </Link>
    </>
  );
}
