-- clubs 테이블에 DELETE 정책 추가 (owner만 삭제 가능)
-- 기존에 DELETE 정책이 없어서 RLS가 모든 삭제를 차단하고 있었음

-- 주의: 서브쿼리에서 바깥 clubs.id를 참조하려면 반드시 한정해야 함.
-- 무한정 `id`는 club_members.id로 해석돼 조건이 항상 거짓이 됨 (00045에서 수정).
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
