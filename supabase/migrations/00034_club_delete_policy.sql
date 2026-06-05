-- clubs 테이블에 DELETE 정책 추가 (owner만 삭제 가능)
-- 기존에 DELETE 정책이 없어서 RLS가 모든 삭제를 차단하고 있었음

CREATE POLICY "Club owner can delete" ON public.clubs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_id = id
        AND user_id = auth.uid()
        AND role = 'owner'
    )
  );
