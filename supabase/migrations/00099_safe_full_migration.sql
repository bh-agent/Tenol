-- ============================================================
-- SAFE FULL MIGRATION (idempotent)
-- Generated from migrations 00001 through 00010
-- Can be run on a database that already has some or all tables.
-- ============================================================

-- ============================================================
-- FROM 00001: PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  phone TEXT,
  ntrp_level NUMERIC(2,1) CHECK (ntrp_level >= 1.0 AND ntrp_level <= 7.0),
  gender TEXT CHECK (gender IN ('M', 'F')),
  bio TEXT,
  region TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- FROM 00001: CLUBS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  region TEXT,
  main_court TEXT,
  invite_code TEXT UNIQUE NOT NULL DEFAULT substr(md5(random()::text), 1, 8),
  is_public BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- FROM 00001: ENUM TYPES (safe creation)
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.club_role AS ENUM ('owner', 'admin', 'member');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.match_status AS ENUM ('upcoming', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.participant_status AS ENUM ('confirmed', 'pending', 'rejected', 'withdrawn');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.participant_type AS ENUM ('member', 'guest');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.draw_type AS ENUM ('random', 'ntrp_balanced', 'mixed_gender', 'manual');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.game_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- FROM 00001: CLUB_MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.club_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_members_club ON public.club_members(club_id);
CREATE INDEX IF NOT EXISTS idx_club_members_user ON public.club_members(user_id);

-- ============================================================
-- FROM 00001: MATCHES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  match_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  court_count INT NOT NULL DEFAULT 1,
  max_participants INT,
  allow_guests BOOLEAN DEFAULT true,
  status public.match_status DEFAULT 'upcoming',
  format TEXT DEFAULT 'doubles' CHECK (format IN ('doubles', 'singles', 'mixed_doubles')),
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_matches_club ON public.matches(club_id);
CREATE INDEX IF NOT EXISTS idx_matches_date ON public.matches(match_date DESC);

-- ============================================================
-- FROM 00001: MATCH_PARTICIPANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.match_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_name TEXT,
  guest_phone TEXT,
  participant_type public.participant_type NOT NULL DEFAULT 'member',
  status public.participant_status NOT NULL DEFAULT 'confirmed',
  ntrp_override NUMERIC(2,1),
  requested_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES public.profiles(id),
  UNIQUE(match_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_match_participants_match ON public.match_participants(match_id);

-- ============================================================
-- FROM 00001: DRAWS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.draws (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  round_number INT NOT NULL DEFAULT 1,
  draw_type public.draw_type NOT NULL DEFAULT 'random',
  is_finalized BOOLEAN DEFAULT false,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(match_id, round_number)
);

CREATE INDEX IF NOT EXISTS idx_draws_match ON public.draws(match_id);

-- ============================================================
-- FROM 00001: GAMES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id UUID NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  court_number INT NOT NULL,
  game_order INT NOT NULL DEFAULT 1,
  team_a_player1_id UUID REFERENCES public.match_participants(id),
  team_a_player2_id UUID REFERENCES public.match_participants(id),
  team_b_player1_id UUID REFERENCES public.match_participants(id),
  team_b_player2_id UUID REFERENCES public.match_participants(id),
  score_team_a INT,
  score_team_b INT,
  set_scores JSONB,
  winner TEXT CHECK (winner IN ('team_a', 'team_b')),
  status public.game_status DEFAULT 'scheduled',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_games_draw ON public.games(draw_id);

-- ============================================================
-- FROM 00001: MEDIA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_club ON public.media(club_id);
CREATE INDEX IF NOT EXISTS idx_media_match ON public.media(match_id);

-- ============================================================
-- FROM 00001: VIEW (CREATE OR REPLACE is already safe)
-- ============================================================
CREATE OR REPLACE VIEW public.player_game_stats AS
SELECT
  mp.user_id,
  g.id AS game_id,
  g.draw_id,
  d.match_id,
  m.club_id,
  m.match_date,
  g.score_team_a,
  g.score_team_b,
  CASE
    WHEN (g.team_a_player1_id = mp.id OR g.team_a_player2_id = mp.id)
      AND g.winner = 'team_a' THEN 'win'
    WHEN (g.team_b_player1_id = mp.id OR g.team_b_player2_id = mp.id)
      AND g.winner = 'team_b' THEN 'win'
    WHEN g.winner IS NOT NULL THEN 'loss'
    ELSE NULL
  END AS result,
  CASE
    WHEN g.team_a_player1_id = mp.id OR g.team_a_player2_id = mp.id THEN 'team_a'
    ELSE 'team_b'
  END AS team
FROM public.match_participants mp
JOIN public.games g ON (
  g.team_a_player1_id = mp.id OR g.team_a_player2_id = mp.id
  OR g.team_b_player1_id = mp.id OR g.team_b_player2_id = mp.id
)
JOIN public.draws d ON g.draw_id = d.id
JOIN public.matches m ON d.match_id = m.id
WHERE mp.user_id IS NOT NULL;

-- ============================================================
-- FROM 00001 + 00009_security_hardening: RLS HELPER FUNCTIONS
-- (CREATE OR REPLACE is already safe; using latest versions with SET search_path)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_club_admin(p_club_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================
-- FROM 00001: ENABLE RLS (safe to run multiple times)
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- FROM 00001: RLS POLICIES - Profiles
-- ============================================================
DROP POLICY IF EXISTS "Profiles viewable by authenticated" ON public.profiles;
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- ============================================================
-- FROM 00001: RLS POLICIES - Clubs
-- ============================================================
DROP POLICY IF EXISTS "Public clubs viewable by all" ON public.clubs;
CREATE POLICY "Public clubs viewable by all" ON public.clubs
  FOR SELECT TO authenticated USING (is_public = true OR public.is_club_member(id));

DROP POLICY IF EXISTS "Authenticated can create clubs" ON public.clubs;
CREATE POLICY "Authenticated can create clubs" ON public.clubs
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Club admins can update" ON public.clubs;
CREATE POLICY "Club admins can update" ON public.clubs
  FOR UPDATE TO authenticated USING (public.is_club_admin(id));

-- ============================================================
-- FROM 00001: RLS POLICIES - Club Members
-- ============================================================
DROP POLICY IF EXISTS "Members viewable by club members" ON public.club_members;
CREATE POLICY "Members viewable by club members" ON public.club_members
  FOR SELECT TO authenticated USING (public.is_club_member(club_id));

DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
CREATE POLICY "Users can join clubs" ON public.club_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage members" ON public.club_members;
CREATE POLICY "Admins can manage members" ON public.club_members
  FOR UPDATE TO authenticated USING (public.is_club_admin(club_id));

DROP POLICY IF EXISTS "Users can leave or admins remove" ON public.club_members;
CREATE POLICY "Users can leave or admins remove" ON public.club_members
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_club_admin(club_id));

-- ============================================================
-- FROM 00001: RLS POLICIES - Matches
-- ============================================================
DROP POLICY IF EXISTS "Matches viewable by club members" ON public.matches;
CREATE POLICY "Matches viewable by club members" ON public.matches
  FOR SELECT TO authenticated USING (public.is_club_member(club_id));

DROP POLICY IF EXISTS "Members can create matches" ON public.matches;
CREATE POLICY "Members can create matches" ON public.matches
  FOR INSERT TO authenticated WITH CHECK (public.is_club_member(club_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Creator or admin can update" ON public.matches;
CREATE POLICY "Creator or admin can update" ON public.matches
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_club_admin(club_id));

-- ============================================================
-- FROM 00001: RLS POLICIES - Match Participants
-- ============================================================
DROP POLICY IF EXISTS "Participants viewable" ON public.match_participants;
CREATE POLICY "Participants viewable" ON public.match_participants
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.is_club_member(m.club_id))
  );

-- NOTE: Original "Can add self as participant" from 00001 is superseded by 00007's "Can add participant"
DROP POLICY IF EXISTS "Can add self as participant" ON public.match_participants;
DROP POLICY IF EXISTS "Can add participant" ON public.match_participants;
CREATE POLICY "Can add participant" ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

DROP POLICY IF EXISTS "Admins manage participants" ON public.match_participants;
CREATE POLICY "Admins manage participants" ON public.match_participants
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id))
    )
  );

-- NOTE: Original "Can withdraw self" from 00001 is superseded by 00007's "Can manage participant"
DROP POLICY IF EXISTS "Can withdraw self" ON public.match_participants;
DROP POLICY IF EXISTS "Can manage participant" ON public.match_participants;
CREATE POLICY "Can manage participant" ON public.match_participants
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id))
    )
  );

-- ============================================================
-- FROM 00001: RLS POLICIES - Draws
-- ============================================================
DROP POLICY IF EXISTS "Draws viewable by club members" ON public.draws;
CREATE POLICY "Draws viewable by club members" ON public.draws
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.is_club_member(m.club_id))
  );

DROP POLICY IF EXISTS "Organizer manages draws" ON public.draws;
CREATE POLICY "Organizer manages draws" ON public.draws
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id)))
  );

-- ============================================================
-- FROM 00001: RLS POLICIES - Games
-- ============================================================
DROP POLICY IF EXISTS "Games viewable by club members" ON public.games;
CREATE POLICY "Games viewable by club members" ON public.games
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.draws d JOIN public.matches m ON d.match_id = m.id WHERE d.id = draw_id AND public.is_club_member(m.club_id))
  );

DROP POLICY IF EXISTS "Organizer manages games" ON public.games;
CREATE POLICY "Organizer manages games" ON public.games
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.draws d JOIN public.matches m ON d.match_id = m.id WHERE d.id = draw_id AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id)))
  );

-- ============================================================
-- FROM 00001: RLS POLICIES - Media
-- ============================================================
DROP POLICY IF EXISTS "Media viewable by club members" ON public.media;
CREATE POLICY "Media viewable by club members" ON public.media
  FOR SELECT TO authenticated USING (public.is_club_member(club_id));

DROP POLICY IF EXISTS "Members can upload media" ON public.media;
CREATE POLICY "Members can upload media" ON public.media
  FOR INSERT TO authenticated WITH CHECK (public.is_club_member(club_id) AND uploaded_by = auth.uid());

-- ============================================================
-- FROM 00002: ADD tennis_start_date COLUMN TO profiles
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'tennis_start_date'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN tennis_start_date DATE;
  END IF;
END $$;

-- ============================================================
-- FROM 00003: ADD feed_type COLUMN TO media
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'media' AND column_name = 'feed_type'
  ) THEN
    ALTER TABLE public.media ADD COLUMN feed_type TEXT NOT NULL DEFAULT 'club' CHECK (feed_type IN ('club', 'personal'));
  END IF;
END $$;

-- ============================================================
-- FROM 00004: ADD file_urls COLUMN TO media (multi-file support)
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'media' AND column_name = 'file_urls'
  ) THEN
    ALTER TABLE public.media ADD COLUMN file_urls JSONB DEFAULT '[]';
  END IF;
END $$;

-- Migrate existing single file_url data to file_urls
UPDATE public.media
SET file_urls = jsonb_build_array(jsonb_build_object('url', file_url, 'type', file_type))
WHERE file_url IS NOT NULL AND (file_urls IS NULL OR file_urls = '[]'::jsonb);

-- ============================================================
-- FROM 00005: RLS POLICIES - Media update/delete
-- ============================================================
DROP POLICY IF EXISTS "Users can update own media" ON public.media;
CREATE POLICY "Users can update own media" ON public.media
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete own media or admin" ON public.media;
CREATE POLICY "Users can delete own media or admin" ON public.media
  FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR public.is_club_admin(club_id)
  );

-- ============================================================
-- FROM 00006: ADD is_onboarded COLUMN TO profiles
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'is_onboarded'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN is_onboarded BOOLEAN NOT NULL DEFAULT false;
    -- Mark existing users as onboarded
    UPDATE public.profiles SET is_onboarded = true;
  END IF;
END $$;

-- ============================================================
-- FROM 00006 + 00009_security_hardening: handle_new_user trigger
-- (latest version with SET search_path)
-- ============================================================
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FROM 00008: ADD guest_gender COLUMN TO match_participants
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'match_participants' AND column_name = 'guest_gender'
  ) THEN
    ALTER TABLE public.match_participants ADD COLUMN guest_gender TEXT CHECK (guest_gender IN ('M', 'F'));
  END IF;
END $$;

-- ============================================================
-- FROM 00009_notifications: NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service can insert notifications" ON public.notifications;
CREATE POLICY "Service can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- FROM 00009_security_hardening: DELETE policy for matches
-- ============================================================
DROP POLICY IF EXISTS "Creator or admin can delete match" ON public.matches;
CREATE POLICY "Creator or admin can delete match" ON public.matches
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.is_club_admin(club_id));

-- ============================================================
-- FROM 00009_security_hardening: UPDATE policy for games (member score input)
-- ============================================================
DROP POLICY IF EXISTS "Members can update game scores" ON public.games;
CREATE POLICY "Members can update game scores" ON public.games
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.draws d
      JOIN public.matches m ON d.match_id = m.id
      WHERE d.id = draw_id AND public.is_club_member(m.club_id)
    )
  );

-- ============================================================
-- FROM 00010: ATOMIC JOIN MATCH FUNCTION
-- ============================================================
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

-- ============================================================
-- RELOAD SCHEMA CACHE
-- ============================================================
NOTIFY pgrst, 'reload schema';
