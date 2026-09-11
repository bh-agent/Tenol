export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

// 폴백 리다이렉트 페이지 — 하단 네비는 /profile/[id]로 직행하므로 거의 안 탄다.
// getSession(로컬 쿠키)만 읽어 auth 서버 왕복 없이 즉시 리다이렉트.
export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) redirect('/login');

  redirect(`/profile/${session.user.id}`);
}
