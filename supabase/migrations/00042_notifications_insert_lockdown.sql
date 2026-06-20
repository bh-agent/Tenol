-- ============================================================
-- 00042: notifications 위조 삽입 차단
-- ============================================================
-- 문제: "Service can insert notifications" 정책이 WITH CHECK(true)라서
--   임의의 authenticated 사용자가 아무 user_id로 가짜 인앱 알림/푸시를 만들 수 있다.
--
-- 해결: 허용형 INSERT 정책을 제거한다. 서버의 createNotification()은
--   service_role 클라이언트로 삽입하도록 이미 변경되었고(service_role은 RLS 우회),
--   앱 내 다른 notifications INSERT 경로는 없다.
--
-- ⚠️ 선행 조건: 앱 코드의 createNotification()이 service_role로 삽입해야 한다
--   (src/lib/actions/notifications.ts + src/lib/supabase/service.ts).
--   SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되어 있어야 알림이 정상 동작한다.
-- ============================================================

DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;

-- authenticated/anon에는 INSERT 권한을 주지 않는다. service_role은 RLS를 우회하므로
-- 서버 측 삽입은 계속 동작한다. (명시적으로 권한 회수)
REVOKE INSERT ON public.notifications FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
