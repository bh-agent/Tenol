-- 멤버별 커스텀 권한: 역할 기본값을 오버라이드
-- custom_permissions가 NULL이면 역할 기본 권한 사용
-- 배열이 있으면 해당 배열의 권한만 적용 (역할 기본 대신)
ALTER TABLE public.club_members
ADD COLUMN IF NOT EXISTS custom_permissions TEXT[] DEFAULT NULL;

COMMENT ON COLUMN public.club_members.custom_permissions IS '커스텀 권한 배열. NULL이면 역할 기본 권한, 배열이면 해당 권한만 적용';
