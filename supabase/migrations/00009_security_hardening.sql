-- ============================================================
-- Security Hardening Migration
-- ============================================================

-- 1. Add DELETE policy for matches (was missing)
CREATE POLICY "Creator or admin can delete match" ON public.matches
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_club_admin(club_id));

-- 2. Fix handle_new_user trigger: set search_path to prevent search_path hijacking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, is_onboarded)
  VALUES (
    NEW.id,
    '사용자',
    NULL,
    false
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Fix is_club_member helper: set search_path
CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 4. Fix is_club_admin helper: set search_path
CREATE OR REPLACE FUNCTION public.is_club_admin(p_club_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 5. Add UPDATE policy for games to allow members to input scores
-- (The existing FOR ALL policy only allows organizer/admin; members with result.input need UPDATE)
CREATE POLICY "Members can update game scores" ON public.games
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.draws d
      JOIN public.matches m ON d.match_id = m.id
      WHERE d.id = draw_id AND public.is_club_member(m.club_id)
    )
  );

NOTIFY pgrst, 'reload schema';
