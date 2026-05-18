-- Migration: handle_new_user 트리거가 OAuth provider의 metadata에서 이름/아바타를 읽어 자동 채움
-- 목적:
--   - Google, Kakao 같은 OAuth 가입 시 user_metadata에 들어있는 이름을 display_name으로 사용
--   - Apple의 경우 Apple JS SDK가 첫 가입 시 name을 별도 제공하므로, 그 값은 client에서 update 처리
--   - 어떤 경우에도 default '사용자'로 fallback (NOT NULL 제약 유지)
-- 효과:
--   - Apple 심사 거절(Guideline 4): "이름을 다시 요구한다" → OAuth가 제공한 이름이 있으면 자동 채워서 화면에 안 보이게 처리 가능
--   - 기존 행에는 영향 없음 (트리거만 교체)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_display_name TEXT;
  v_avatar_url TEXT;
BEGIN
  -- raw_user_meta_data에서 이름 후보를 순서대로 추출
  v_display_name := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'preferred_username'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'user_name'), ''),
    -- Kakao
    NULLIF(TRIM(NEW.raw_user_meta_data->'kakao_account'->'profile'->>'nickname'), ''),
    '사용자'
  );

  v_avatar_url := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'avatar_url'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'picture'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->'kakao_account'->'profile'->>'profile_image_url'), ''),
    NULL
  );

  INSERT INTO public.profiles (id, display_name, real_name, avatar_url, is_onboarded)
  VALUES (
    NEW.id,
    v_display_name,
    -- OAuth 이름이 진짜 이름일 가능성이 높으므로 real_name으로도 사용
    -- (사용자가 추후 프로필 편집에서 변경 가능)
    CASE WHEN v_display_name = '사용자' THEN NULL ELSE v_display_name END,
    v_avatar_url,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 트리거는 이미 존재; 새 함수만 적용됨
