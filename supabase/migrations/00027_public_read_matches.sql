-- ============================================================
-- 00027: Public read access for matches, participants, draws, games
--
-- Problem: Migration 00026 opened clubs, club_members, and media
-- for any authenticated user, but matches, match_participants,
-- draws, and games still require club membership for SELECT.
-- Non-members see empty match/stats tabs when viewing a club.
--
-- Fix: Allow any authenticated user to READ (SELECT) these tables.
-- Write policies remain unchanged.
-- ============================================================

-- 1. matches: allow any authenticated user to see matches
DROP POLICY IF EXISTS "Matches viewable by club members" ON public.matches;
CREATE POLICY "Matches viewable by authenticated" ON public.matches
  FOR SELECT TO authenticated USING (true);

-- 2. match_participants: allow any authenticated user to see participants
DROP POLICY IF EXISTS "Participants viewable" ON public.match_participants;
CREATE POLICY "Participants viewable by authenticated" ON public.match_participants
  FOR SELECT TO authenticated USING (true);

-- 3. draws: allow any authenticated user to see draws
DROP POLICY IF EXISTS "Draws viewable by club members" ON public.draws;
CREATE POLICY "Draws viewable by authenticated" ON public.draws
  FOR SELECT TO authenticated USING (true);

-- 4. games: allow any authenticated user to see games
DROP POLICY IF EXISTS "Games viewable by club members" ON public.games;
CREATE POLICY "Games viewable by authenticated" ON public.games
  FOR SELECT TO authenticated USING (true);
