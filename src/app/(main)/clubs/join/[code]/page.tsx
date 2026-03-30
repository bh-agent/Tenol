export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import { Card } from '@/components/ui/card';
import { TopBar } from '@/components/layout/top-bar';
import { createClient } from '@/lib/supabase/server';
import { MapPin, Users, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { JoinByLinkForm } from './join-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const supabase = await createClient();

  const { data: club } = await supabase
    .from('clubs')
    .select('name, description, logo_url')
    .eq('invite_code', code)
    .maybeSingle();

  if (!club) {
    return { title: '클럽 가입 - 테놀' };
  }

  const title = `${club.name} - 테놀 클럽 초대`;
  const description = club.description || `${club.name} 클럽에 가입하세요!`;
  const images = club.logo_url
    ? [{ url: club.logo_url, width: 512, height: 512, alt: club.name }, { url: '/icons/icon-512.png', width: 512, height: 512, alt: '테놀' }]
    : [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: '테놀' }];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: '테놀',
      images,
      locale: 'ko_KR',
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: images.map((img) => img.url),
    },
  };
}

export default async function JoinByLinkPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Look up club by invite code
  const { data: club } = await supabase
    .from('clubs')
    .select('id, name, description, region, invite_code')
    .eq('invite_code', code)
    .maybeSingle();

  if (!club) {
    return (
      <>
        <TopBar title="클럽 가입" backHref="/clubs" />
        <div className="px-4 py-12 flex flex-col items-center gap-4 animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-lg font-bold text-foreground">
            유효하지 않은 초대 링크입니다
          </h2>
          <p className="text-sm text-muted-foreground text-center">
            초대 링크가 만료되었거나 올바르지 않습니다.
            <br />
            클럽 관리자에게 새 링크를 요청해 주세요.
          </p>
        </div>
      </>
    );
  }

  // Get member count
  const { count: memberCount } = await supabase
    .from('club_members')
    .select('id', { count: 'exact', head: true })
    .eq('club_id', club.id);

  // Check if already a member
  let isMember = false;
  let isPending = false;
  let userProfile: { ntrp_level: number | null; tennis_start_date: string | null } | null = null;

  if (user) {
    const [{ data: existingMember }, { data: profile }] = await Promise.all([
      supabase
        .from('club_members')
        .select('id')
        .eq('club_id', club.id)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('ntrp_level, tennis_start_date')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    isMember = !!existingMember;
    userProfile = profile;

    if (!isMember) {
      const { data: existingRequest } = await supabase
        .from('club_join_requests')
        .select('id, status')
        .eq('club_id', club.id)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      isPending = !!existingRequest;
    }
  }

  return (
    <>
      <TopBar title="클럽 가입" backHref="/clubs" />

      <div className="px-4 py-6 space-y-6 animate-fade-in">
        <Card variant="glow" padding="lg">
          <div className="space-y-4">
            {/* Club info */}
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🎾</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">{club.name}</h2>
              {club.description && (
                <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                  {club.description}
                </p>
              )}
            </div>

            {/* Meta info */}
            <div className="flex flex-wrap justify-center gap-3 text-sm text-muted-foreground">
              {club.region && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-elevated border border-border">
                  <MapPin className="w-3.5 h-3.5 text-primary/70" />
                  {club.region}
                </span>
              )}
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-elevated border border-border">
                <Users className="w-3.5 h-3.5 text-primary/70" />
                {memberCount ?? 0}명
              </span>
            </div>

            {/* Status / Action */}
            <div className="pt-2 border-t border-border">
              {isMember ? (
                <div className="flex items-center justify-center gap-2 py-3 text-primary">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium text-sm">
                    이미 가입된 클럽입니다
                  </span>
                </div>
              ) : isPending ? (
                <div className="flex items-center justify-center gap-2 py-3 text-amber-400">
                  <Clock className="w-5 h-5" />
                  <span className="font-medium text-sm">
                    이미 가입 신청한 클럽입니다
                  </span>
                </div>
              ) : (
                <JoinByLinkForm inviteCode={code} profile={userProfile} />
              )}
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
