-- 00026: 비멤버도 클럽/멤버/피드를 볼 수 있도록 SELECT 개방
DROP POLICY IF EXISTS "Public clubs viewable by all" ON public.clubs;
DROP POLICY IF EXISTS "Clubs viewable by authenticated" ON public.clubs;
CREATE POLICY "Clubs viewable by authenticated" ON public.clubs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members viewable by club members" ON public.club_members;
DROP POLICY IF EXISTS "Members viewable by authenticated" ON public.club_members;
CREATE POLICY "Members viewable by authenticated" ON public.club_members
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Media viewable by club members" ON public.media;
DROP POLICY IF EXISTS "Media viewable by authenticated" ON public.media;
CREATE POLICY "Media viewable by authenticated" ON public.media
  FOR SELECT TO authenticated USING (true);

-- 00027: 비멤버도 경기/참가자/대진표/게임을 볼 수 있도록 SELECT 개방
DROP POLICY IF EXISTS "Matches viewable by club members or guests" ON public.matches;
DROP POLICY IF EXISTS "Matches viewable by authenticated" ON public.matches;
CREATE POLICY "Matches viewable by authenticated" ON public.matches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Participants viewable" ON public.match_participants;
DROP POLICY IF EXISTS "Participants viewable by authenticated" ON public.match_participants;
CREATE POLICY "Participants viewable by authenticated" ON public.match_participants
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Draws viewable by club members" ON public.draws;
DROP POLICY IF EXISTS "Draws viewable by authenticated" ON public.draws;
CREATE POLICY "Draws viewable by authenticated" ON public.draws
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Games viewable by club members" ON public.games;
DROP POLICY IF EXISTS "Games viewable by authenticated" ON public.games;
CREATE POLICY "Games viewable by authenticated" ON public.games
  FOR SELECT TO authenticated USING (true);
