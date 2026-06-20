-- ============================================================
-- 00043: app_logs 접근 제한 (개인정보/시스템 로그 노출 차단)
-- ============================================================
-- 문제(00033): SELECT USING(true) → 아무 사용자나 모든 로그(타인 user_id, 에러 스택,
--   경로 등)를 읽을 수 있고, INSERT WITH CHECK(true) → 로그 위조/플러딩 가능.
--
-- 해결:
--   - SELECT: 본인 로그 또는 관리자만.
--   - INSERT: 본인(user_id = auth.uid()) 또는 user_id IS NULL(비로그인/크론)만.
--     service_role은 RLS를 우회하므로 서버 내부 로깅은 영향 없음.
--   - API 라우트(/api/logs)는 GET을 관리자로 제한, POST 입력 길이/형식을 검증(코드에서 처리).
-- ============================================================

DROP POLICY IF EXISTS "Read own logs or all for service" ON public.app_logs;
DROP POLICY IF EXISTS "Read own logs or admin" ON public.app_logs;
DROP POLICY IF EXISTS "Server can insert logs" ON public.app_logs;
DROP POLICY IF EXISTS "Insert own logs" ON public.app_logs;

-- SELECT: 본인 로그 또는 관리자
CREATE POLICY "Read own logs or admin" ON public.app_logs
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- INSERT: 본인 또는 null 로그만 (타인 user_id로 위조 불가). service_role은 우회.
CREATE POLICY "Insert own logs" ON public.app_logs
  FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

NOTIFY pgrst, 'reload schema';
