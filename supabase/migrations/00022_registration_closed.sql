-- Add registration_closed flag to matches
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS registration_closed BOOLEAN DEFAULT false;

-- Update the join_match_atomically function to check registration_closed instead of capacity
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
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_closed BOOLEAN;
  v_participant_id UUID;
BEGIN
  SELECT registration_closed INTO v_closed
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

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
