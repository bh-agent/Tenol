-- ============================================================
-- 00041: profiles 권한 컬럼 보호 (권한 상승 취약점 차단)
-- ============================================================
-- 문제: "Users can update own profile" 정책이 자기 행 전체를 UPDATE 허용하므로,
--   일반 사용자가 anon 키 클라이언트로 자신의 is_admin = true / is_banned = false를
--   직접 설정해 관리자 권한을 탈취하거나 정지를 해제할 수 있다.
--
-- 해결: BEFORE UPDATE 트리거로 is_admin/is_banned/banned_reason 변경을
--   "현재 actor가 이미 관리자일 때"만 허용한다.
--   - 관리자 액션(banUser/unbanUser)은 관리자 세션으로 실행되므로 통과.
--   - 일반 사용자의 display_name/bio/ntrp 등 일반 컬럼 수정은 영향 없음.
-- 여러 번 실행해도 안전(idempotent).
-- ============================================================

CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER AS $$
BEGIN
  IF (
        NEW.is_admin       IS DISTINCT FROM OLD.is_admin
     OR NEW.is_banned      IS DISTINCT FROM OLD.is_banned
     OR NEW.banned_reason  IS DISTINCT FROM OLD.banned_reason
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
       WHERE id = auth.uid() AND is_admin = true
     )
  THEN
    RAISE EXCEPTION '권한 컬럼은 관리자만 변경할 수 있습니다';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_privilege_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_privilege_escalation();

-- 사용자 자기 행 수정 정책에 WITH CHECK 명시 (다른 사람 행으로 바꾸지 못하도록 방어 심화)
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

NOTIFY pgrst, 'reload schema';
