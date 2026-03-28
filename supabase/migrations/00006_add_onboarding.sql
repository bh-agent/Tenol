-- 온보딩 완료 여부 플래그
ALTER TABLE public.profiles ADD COLUMN is_onboarded BOOLEAN NOT NULL DEFAULT false;

-- 기존 유저는 온보딩 완료 처리
UPDATE public.profiles SET is_onboarded = true;

-- 트리거 업데이트: 신규 유저는 임시 이름, is_onboarded = false
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, is_onboarded)
  VALUES (
    NEW.id,
    '사용자',
    NULL,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
