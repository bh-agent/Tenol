-- Atomic join match function to prevent race condition on max_participants
CREATE OR REPLACE FUNCTION public.join_match_atomically(
  p_match_id UUID,
  p_user_id UUID,
  p_participant_type TEXT DEFAULT 'member',
  p_status TEXT DEFAULT 'confirmed',
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_guest_gender TEXT DEFAULT NULL,
  p_ntrp_override NUMERIC(2,1) DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max INT;
  v_current INT;
  v_participant_id UUID;
BEGIN
  -- Lock the match row to prevent concurrent modifications
  SELECT max_participants INTO v_max
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  -- Check capacity if max_participants is set
  IF v_max IS NOT NULL THEN
    SELECT COUNT(*) INTO v_current
    FROM match_participants
    WHERE match_id = p_match_id
      AND status IN ('confirmed', 'pending');

    IF v_current >= v_max THEN
      RAISE EXCEPTION 'MATCH_FULL';
    END IF;
  END IF;

  -- Insert participant
  INSERT INTO match_participants (
    match_id, user_id, participant_type, status,
    guest_name, guest_phone, guest_gender, ntrp_override
  ) VALUES (
    p_match_id, p_user_id, p_participant_type, p_status,
    p_guest_name, p_guest_phone, p_guest_gender, p_ntrp_override
  )
  RETURNING id INTO v_participant_id;

  RETURN v_participant_id;
END;
$$;
