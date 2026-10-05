-- 00055: 디바이스 토큰 저장 RPC — "같은 기기, 다른 계정" 재로그인 시 저장 실패 수정
--
-- 증상: '디바이스 토큰 저장 실패' 에러가 2주간 36회. 원인: upsert(onConflict token)가
-- 이전 유저 소유의 기존 행을 UPDATE하려 하지만 RLS(UPDATE USING auth.uid()=user_id)에
-- 막힘 → 그 유저는 푸시를 영영 못 받음.
--
-- 해법: 푸시 토큰은 '기기'에 귀속되므로, 현재 로그인한 유저에게 재배정하는 것이 맞다.
-- SECURITY DEFINER로 소유자 무관 삭제 후 insert. auth.uid() 필수라 위조 불가.
CREATE OR REPLACE FUNCTION public.save_device_token(p_token TEXT, p_platform TEXT)
RETURNS VOID AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_platform NOT IN ('ios', 'android', 'web') THEN
    RAISE EXCEPTION 'invalid platform';
  END IF;
  IF length(p_token) < 10 OR length(p_token) > 4096 THEN
    RAISE EXCEPTION 'invalid token';
  END IF;

  -- 이 기기 토큰의 이전 소유 기록 제거(다른 유저 소유 포함) 후 현재 유저로 저장
  DELETE FROM public.device_tokens WHERE token = p_token;
  INSERT INTO public.device_tokens (token, user_id, platform, updated_at)
  VALUES (p_token, auth.uid(), p_platform, now());
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.save_device_token(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_device_token(TEXT, TEXT) TO authenticated;
