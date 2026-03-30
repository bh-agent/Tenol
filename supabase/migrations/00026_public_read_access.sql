-- ============================================================
-- 00026: Public read access for authenticated users
--
-- Problem: Non-members cannot view club feeds, member lists,
-- or media because RLS SELECT policies require club membership.
--
-- Fix: Allow any authenticated user to READ (SELECT) club info,
-- club members, and media. Write policies remain unchanged.
-- ============================================================

-- 1. clubs: allow any authenticated user to see any club
--    (was: public clubs OR members only)
DROP POLICY IF EXISTS "Public clubs viewable by all" ON public.clubs;
CREATE POLICY "Clubs viewable by authenticated" ON public.clubs
  FOR SELECT TO authenticated USING (true);

-- 2. club_members: allow any authenticated user to see member lists
--    (was: members only)
DROP POLICY IF EXISTS "Members viewable by club members" ON public.club_members;
CREATE POLICY "Members viewable by authenticated" ON public.club_members
  FOR SELECT TO authenticated USING (true);

-- 3. media: allow any authenticated user to see all media
--    (was: members only)
DROP POLICY IF EXISTS "Media viewable by club members" ON public.media;
CREATE POLICY "Media viewable by authenticated" ON public.media
  FOR SELECT TO authenticated USING (true);

-- Note: profiles, media_likes, media_comments already have
-- open SELECT policies (USING true) from initial/social migrations.
--
-- Note: media_with_counts is a VIEW on media table, so it inherits
-- the media RLS policy. No separate policy needed.
--
-- INSERT/UPDATE/DELETE policies are NOT changed.
