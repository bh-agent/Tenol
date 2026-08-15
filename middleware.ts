import { updateSession } from '@/lib/supabase/middleware';
import { type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // /api 제외: 각 API 라우트가 자체 인증(CRON_SECRET, getUser, requireAdmin 등)을 수행하며,
  // 미들웨어가 API까지 /login으로 리다이렉트하면 Vercel Cron(쿠키 없음)이 영원히 차단됨.
  // 정적 파일(manifest/sw/offline/robots/sitemap)도 인증 대상이 아니므로 제외.
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|manifest\\.json|sw\\.js|offline\\.html|robots\\.txt|sitemap\\.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
