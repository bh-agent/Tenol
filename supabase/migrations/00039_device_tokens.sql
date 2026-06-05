-- 푸시 알림용 디바이스 토큰 저장
-- 네이티브 앱(@capacitor/push-notifications)에서 발급받은 FCM/APNs 토큰을 저장한다.
-- 서버는 알림 생성 시 이 테이블을 조회해 해당 사용자의 모든 기기로 푸시를 발송한다.

CREATE TABLE IF NOT EXISTS public.device_tokens (
  token TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON public.device_tokens(user_id);

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- 사용자는 자신의 토큰만 조회/관리할 수 있다.
DROP POLICY IF EXISTS "Users view own device tokens" ON public.device_tokens;
CREATE POLICY "Users view own device tokens" ON public.device_tokens
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own device tokens" ON public.device_tokens;
CREATE POLICY "Users insert own device tokens" ON public.device_tokens
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own device tokens" ON public.device_tokens;
CREATE POLICY "Users update own device tokens" ON public.device_tokens
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own device tokens" ON public.device_tokens;
CREATE POLICY "Users delete own device tokens" ON public.device_tokens
  FOR DELETE USING (auth.uid() = user_id);
