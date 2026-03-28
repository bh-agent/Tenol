-- 본인 게시물 수정 가능
CREATE POLICY "Users can update own media" ON public.media
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid());

-- 본인 게시물 삭제 또는 클럽 관리자 삭제 가능
CREATE POLICY "Users can delete own media or admin" ON public.media
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.is_club_admin(club_id)
  );

NOTIFY pgrst, 'reload schema';
