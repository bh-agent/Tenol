import { BottomNav } from '@/components/layout/bottom-nav';
import { ScrollTopButton } from '@/components/ui/scroll-top-button';
import { NativeInit } from '@/components/native/native-init';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_onboarded, is_banned')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_banned) {
    await supabase.auth.signOut();
    redirect('/login?banned=1');
  }

  if (!profile || !profile.is_onboarded) {
    redirect('/onboarding');
  }

  return (
    <div className="flex flex-col min-h-dvh max-w-lg mx-auto w-full">
      <NativeInit />
      {/* pb = BottomNav(64px) + glass padding(16px) + safe-area-inset-bottom + extra 8px */}
      <main className="flex-1" style={{ paddingBottom: 'calc(88px + env(safe-area-inset-bottom))' }}>
        {children}
      </main>
      <ScrollTopButton />
      <BottomNav />
    </div>
  );
}
