-- ============================================================
-- 00045: 클럽 삭제 정책 스코프 버그 수정 (00034/00044의 결함)
-- ============================================================
-- 문제: 서브쿼리 안의 `WHERE club_id = id`에서 `id`가 바깥 clubs.id가 아니라
--   club_members 자신의 id 컬럼으로 해석됨(내부 스코프 우선) → 조건이 항상 거짓
--   → 정책이 존재해도 owner의 클럽 삭제가 0건 처리됨 (2026-08-16 프로덕션 실측 확인).
-- 수정: 별칭으로 외부 참조를 명시적으로 한정.
-- ============================================================

DROP POLICY IF EXISTS "Club owner can delete" ON public.clubs;
CREATE POLICY "Club owner can delete" ON public.clubs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members cm
      WHERE cm.club_id = clubs.id
        AND cm.user_id = auth.uid()
        AND cm.role = 'owner'
    )
  );

-- 검증: DELETE 정책의 조건식에 'cm.club_id = clubs.id'가 보여야 함
SELECT policyname, qual FROM pg_policies WHERE tablename = 'clubs' AND cmd = 'DELETE';
