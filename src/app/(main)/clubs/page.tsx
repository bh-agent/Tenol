export const dynamic = 'force-dynamic';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { TopBar } from '@/components/layout/top-bar';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { getMyClubs } from '@/lib/queries/clubs';
import { formatRole } from '@/lib/utils/format';
import { Users, Plus, MapPin, Search } from 'lucide-react';
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
            >
              <Search className="w-5 h-5 text-muted-foreground" />
            </Link>
          </div>
        }
      />

      <div className="px-4 py-5">
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">
              <span className="text-gradient">내 클럽</span>
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {clubs.length > 0 ? `${clubs.length}개의 클럽에 가입됨` : '클럽에 가입해보세요'}
            </p>
          </div>
          <Link
            href="/clubs/new"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-black text-sm font-semibold hover:bg-primary-light transition-all duration-200 hover:shadow-[0_0_24px_rgba(0,230,118,0.25)] active:scale-[0.97]"
          >
            <Plus className="w-4 h-4" />
            만들기
          </Link>
        </div>

        {clubs.length === 0 ? (
          <EmptyState
            icon={Users}
            title="아직 가입한 클럽이 없어요"
            description="새 클럽을 만들거나, 초대 코드로 기존 클럽에 가입해보세요"
            actionLabel="클럽 만들기"
            actionHref="/clubs/new"
          />
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
        className="fixed bottom-24 right-5 z-40 w-14 h-14 rounded-full bg-primary text-black flex items-center justify-center shadow-lg hover:shadow-[0_0_30px_rgba(0,230,118,0.35)] transition-all duration-300 active:scale-90"
        style={{ animation: 'pulse-glow 2s ease-in-out infinite' }}
      >
        <Plus className="w-6 h-6" />
      </Link>
    </>
  );
}
