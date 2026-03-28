-- 비회원 참가자 추가를 위해 기존 INSERT 정책 삭제 후 재생성
DROP POLICY IF EXISTS "Can add self as participant" ON public.match_participants;

-- 인증된 유저가 참가자 추가 가능 (본인 또는 비회원)
CREATE POLICY "Can add participant" ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

-- 비회원 참가자 삭제를 위해 DELETE 정책 업데이트
DROP POLICY IF EXISTS "Can withdraw self" ON public.match_participants;

CREATE POLICY "Can manage participant" ON public.match_participants
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id))
    )
  );

NOTIFY pgrst, 'reload schema';
