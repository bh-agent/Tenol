-- Fix 1: Allow authenticated users to view matches with allow_guests = true
-- This enables guests clicking "게스트 신청" from recruitment posts to see the match page
DROP POLICY IF EXISTS "Matches viewable by club members" ON public.matches;
CREATE POLICY "Matches viewable by club members or guests" ON public.matches
  FOR SELECT TO authenticated USING (
    public.is_club_member(club_id) OR allow_guests = true
  );

-- Fix 2: Allow non-members to view match_participants for guest-enabled matches
-- (needed so the match detail page can render participant lists)
DROP POLICY IF EXISTS "Participants viewable" ON public.match_participants;
CREATE POLICY "Participants viewable" ON public.match_participants
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (public.is_club_member(m.club_id) OR m.allow_guests = true)
    )
  );

-- Fix 3: Restore MATCH_NOT_FOUND check and search_path in join_match_atomically
-- The 00022 migration dropped these safety checks
CREATE OR REPLACE FUNCTION public.join_match_atomically(
  p_match_id UUID,
  p_user_id UUID,
  p_participant_type TEXT DEFAULT 'member',
  p_status TEXT DEFAULT 'confirmed',
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_guest_gender TEXT DEFAULT NULL,
  p_ntrp_override NUMERIC(2,1) DEFAULT NULL,
  p_introduction TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed BOOLEAN;
  v_participant_id UUID;
BEGIN
  SELECT registration_closed INTO v_closed
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_closed = true THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED';
  END IF;

  INSERT INTO match_participants (
    match_id, user_id, participant_type, status,
    guest_name, guest_phone, guest_gender, ntrp_override, introduction
  ) VALUES (
    p_match_id, p_user_id, p_participant_type, p_status,
    p_guest_name, p_guest_phone, p_guest_gender, p_ntrp_override, p_introduction
  )
  RETURNING id INTO v_participant_id;

  RETURN v_participant_id;
END;
$$;
