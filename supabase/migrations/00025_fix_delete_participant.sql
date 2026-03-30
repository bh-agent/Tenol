DROP POLICY IF EXISTS "Can withdraw self" ON public.match_participants;
DROP POLICY IF EXISTS "Can manage participant" ON public.match_participants;
CREATE POLICY "Can manage participant" ON public.match_participants
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id))
    )
  );
