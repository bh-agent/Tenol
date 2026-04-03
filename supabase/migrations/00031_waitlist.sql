-- ============================================================
-- WAITLIST FEATURE: Add 'waitlisted' status to match_participants
-- ============================================================

-- 1. Add 'waitlisted' to the participant_status enum
ALTER TYPE public.participant_status ADD VALUE IF NOT EXISTS 'waitlisted';

-- 2. Create promote_waitlist function
-- Promotes the earliest waitlisted participant to confirmed if there's room
CREATE OR REPLACE FUNCTION public.promote_waitlist(p_match_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT;
  v_confirmed INT;
  v_next_id UUID;
  v_next_user_id UUID;
BEGIN
  -- Get max_participants
  SELECT max_participants INTO v_max
  FROM matches
  WHERE id = p_match_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- No limit means no waitlist logic needed
  IF v_max IS NULL THEN
    RETURN NULL;
  END IF;

  -- Count current confirmed participants
  SELECT COUNT(*) INTO v_confirmed
  FROM match_participants
  WHERE match_id = p_match_id
    AND status = 'confirmed';

  -- If still full, nothing to promote
  IF v_confirmed >= v_max THEN
    RETURN NULL;
  END IF;

  -- Find the earliest waitlisted participant
  SELECT id, user_id INTO v_next_id, v_next_user_id
  FROM match_participants
  WHERE match_id = p_match_id
    AND status = 'waitlisted'
  ORDER BY requested_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_next_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Promote to confirmed
  UPDATE match_participants
  SET status = 'confirmed',
      responded_at = now()
  WHERE id = v_next_id;

  RETURN v_next_id;
END;
$$;

-- 3. Update join_match_atomically to support waitlist
-- When match is full and status would be 'confirmed', insert as 'waitlisted' instead
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
  v_max INT;
  v_current INT;
  v_final_status TEXT;
  v_participant_id UUID;
BEGIN
  SELECT registration_closed, max_participants INTO v_closed, v_max
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_closed = true THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED';
  END IF;

  -- Determine final status: if match is full and trying to join as confirmed, waitlist instead
  v_final_status := p_status;
  IF v_max IS NOT NULL AND p_status = 'confirmed' THEN
    SELECT COUNT(*) INTO v_current
    FROM match_participants
    WHERE match_id = p_match_id
      AND status = 'confirmed';

    IF v_current >= v_max THEN
      v_final_status := 'waitlisted';
    END IF;
  END IF;

  INSERT INTO match_participants (
    match_id, user_id, participant_type, status,
    guest_name, guest_phone, guest_gender, ntrp_override, introduction
  ) VALUES (
    p_match_id, p_user_id, p_participant_type, v_final_status,
    p_guest_name, p_guest_phone, p_guest_gender, p_ntrp_override, p_introduction
  )
  RETURNING id INTO v_participant_id;

  RETURN v_participant_id;
END;
$$;
