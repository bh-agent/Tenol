-- Allow club admins to insert match_participants for any user (substitute/replace flow)
-- Current policy only allows user_id = auth.uid() OR user_id IS NULL
DROP POLICY IF EXISTS "Can add participant" ON public.match_participants;
CREATE POLICY "Can add participant" ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id))
    )
  );
