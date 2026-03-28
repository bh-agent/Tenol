export const dynamic = 'force-dynamic';

import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { TopBar } from '@/components/layout/top-bar';
import { ClubAvatar } from '@/components/club/club-avatar';
import { ProfileFeed } from '@/components/profile/profile-feed';
import { createClient } from '@/lib/supabase/server';
import { getPlayerStats } from '@/lib/queries/stats';
import { ChevronRight, MapPin } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const supabase = await createClient();

  // Fetch profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) notFound();

  // Fetch stats and clubs in parallel
  const [stats, clubsResult] = await Promise.all([
    getPlayerStats(userId),
    supabase
      .from('club_members')
      .select(`
        club_id, role,
        clubs (id, name, logo_url, region, is_public)
      `)
      .eq('user_id', userId),
  ]);

  // Only show public clubs
  const clubs = (clubsResult.data || [])
    .filter((m) => (m.clubs as any)?.is_public !== false)
    .map((m) => ({ ...m.clubs, role: m.role }));

  return (
    <>
      <TopBar title={profile.display_name} backHref="/clubs" />

      <div className="px-4 py-5 space-y-5 animate-fade-in">
        {/* Profile header */}
        <div className="flex flex-col items-center text-center">
          <div className="ring-2 ring-primary/30 ring-offset-2 ring-offset-background rounded-full">
            <Avatar
              src={profile.avatar_url}
              alt={profile.display_name}
              fallback={profile.display_name}
              size="xl"
            />
          </div>

          <h2 className="text-xl font-bold text-foreground mt-3">
            {profile.display_name}
          </h2>

          {profile.bio && (
            <p className="text-sm text-muted-foreground mt-1 max-w-xs">
              {profile.bio}
            </p>
          )}

          {/* Info badges */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
            {profile.ntrp_level && (
              <Badge variant="primary">NTRP {profile.ntrp_level}</Badge>
            )}
            {profile.region && (
              <Badge variant="outline">
                <MapPin className="w-3 h-3 mr-1" />
                {profile.region}
              </Badge>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-xl font-bold text-foreground">{stats.total}</p>
            <p className="text-xs text-muted-foreground">경기</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xl font-bold text-success">{stats.wins}</p>
            <p className="text-xs text-muted-foreground">승</p>
          </div>
          <div className="w-px h-8 bg-border" />
          <div className="text-center">
            <p className="text-xl font-bold text-destructive">{stats.losses}</p>
            <p className="text-xs text-muted-foreground">패</p>
          </div>
          {stats.total > 0 && (
            <>
              <div className="w-px h-8 bg-border" />
              <div className="text-center">
                <p className="text-xl font-bold text-primary">{stats.winRate}%</p>
                <p className="text-xs text-muted-foreground">승률</p>
              </div>
            </>
          )}
        </div>

        {/* Clubs */}
        {clubs.length > 0 && (
          <Card variant="glass" padding="lg">
            <h3 className="font-semibold text-foreground mb-3">가입한 클럽</h3>
            <div className="space-y-1.5">
              {clubs.map((club: any) => (
                <Link key={club.id} href={`/clubs/${club.id}`}>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-elevated transition-all duration-200 active:scale-[0.98] group">
                    <ClubAvatar logoUrl={club.logo_url} name={club.name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {club.name}
                      </p>
                      {club.region && (
                        <p className="text-[11px] text-muted-foreground">{club.region}</p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}

        {/* Media feed (grid view) */}
        <ProfileFeed userId={userId} isOwnProfile={false} />
      </div>
    </>
  );
}
