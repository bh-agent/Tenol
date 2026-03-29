-- Allow club admins/owners to add members (needed for join request approval)
-- The existing INSERT policy only allows user_id = auth.uid(), which blocks
-- admins from inserting a member row for the approved user.
CREATE POLICY "Admins can add members" ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_club_admin(club_id));
