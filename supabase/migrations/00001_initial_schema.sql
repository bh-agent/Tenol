-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.profiles (
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

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', '사용자'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- CLUBS
-- ============================================================
CREATE TABLE public.clubs (
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
-- CLUB_MEMBERS
-- ============================================================
CREATE TYPE public.club_role AS ENUM ('owner', 'admin', 'member');

CREATE TABLE public.club_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.club_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, user_id)
);

CREATE INDEX idx_club_members_club ON public.club_members(club_id);
CREATE INDEX idx_club_members_user ON public.club_members(user_id);

-- ============================================================
-- MATCHES (경기/모임)
-- ============================================================
CREATE TYPE public.match_status AS ENUM ('upcoming', 'in_progress', 'completed', 'cancelled');

CREATE TABLE public.matches (
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

CREATE INDEX idx_matches_club ON public.matches(club_id);
CREATE INDEX idx_matches_date ON public.matches(match_date DESC);

-- ============================================================
-- MATCH_PARTICIPANTS
-- ============================================================
CREATE TYPE public.participant_status AS ENUM ('confirmed', 'pending', 'rejected', 'withdrawn');
CREATE TYPE public.participant_type AS ENUM ('member', 'guest');

CREATE TABLE public.match_participants (
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

CREATE INDEX idx_match_participants_match ON public.match_participants(match_id);

-- ============================================================
-- DRAWS (대진표 라운드)
-- ============================================================
CREATE TYPE public.draw_type AS ENUM ('random', 'ntrp_balanced', 'mixed_gender', 'manual');

CREATE TABLE public.draws (
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

CREATE INDEX idx_draws_match ON public.draws(match_id);

-- ============================================================
-- GAMES (개별 게임)
-- ============================================================
CREATE TYPE public.game_status AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

CREATE TABLE public.games (
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

CREATE INDEX idx_games_draw ON public.games(draw_id);

-- ============================================================
-- MEDIA (P4)
-- ============================================================
CREATE TABLE public.media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('image', 'video')),
  caption TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_media_club ON public.media(club_id);
CREATE INDEX idx_media_match ON public.media(match_id);

-- ============================================================
-- VIEWS
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
-- RLS HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_club_admin(p_club_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- RLS POLICIES
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Profiles viewable by authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Clubs
CREATE POLICY "Public clubs viewable by all" ON public.clubs
  FOR SELECT TO authenticated USING (is_public = true OR public.is_club_member(id));
CREATE POLICY "Authenticated can create clubs" ON public.clubs
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Club admins can update" ON public.clubs
  FOR UPDATE TO authenticated USING (public.is_club_admin(id));

-- Club members
CREATE POLICY "Members viewable by club members" ON public.club_members
  FOR SELECT TO authenticated USING (public.is_club_member(club_id));
CREATE POLICY "Users can join clubs" ON public.club_members
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage members" ON public.club_members
  FOR UPDATE TO authenticated USING (public.is_club_admin(club_id));
CREATE POLICY "Users can leave or admins remove" ON public.club_members
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_club_admin(club_id));

-- Matches
CREATE POLICY "Matches viewable by club members" ON public.matches
  FOR SELECT TO authenticated USING (public.is_club_member(club_id));
CREATE POLICY "Members can create matches" ON public.matches
  FOR INSERT TO authenticated WITH CHECK (public.is_club_member(club_id) AND created_by = auth.uid());
CREATE POLICY "Creator or admin can update" ON public.matches
  FOR UPDATE TO authenticated USING (created_by = auth.uid() OR public.is_club_admin(club_id));

-- Match participants
CREATE POLICY "Participants viewable" ON public.match_participants
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.is_club_member(m.club_id))
  );
CREATE POLICY "Can add self as participant" ON public.match_participants
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins manage participants" ON public.match_participants
  FOR UPDATE TO authenticated USING (
    user_id = auth.uid() OR EXISTS (
      SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id))
    )
  );
CREATE POLICY "Can withdraw self" ON public.match_participants
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Draws
CREATE POLICY "Draws viewable by club members" ON public.draws
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND public.is_club_member(m.club_id))
  );
CREATE POLICY "Organizer manages draws" ON public.draws
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id)))
  );

-- Games
CREATE POLICY "Games viewable by club members" ON public.games
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.draws d JOIN public.matches m ON d.match_id = m.id WHERE d.id = draw_id AND public.is_club_member(m.club_id))
  );
CREATE POLICY "Organizer manages games" ON public.games
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.draws d JOIN public.matches m ON d.match_id = m.id WHERE d.id = draw_id AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id)))
  );

-- Media
CREATE POLICY "Media viewable by club members" ON public.media
  FOR SELECT TO authenticated USING (public.is_club_member(club_id));
CREATE POLICY "Members can upload media" ON public.media
  FOR INSERT TO authenticated WITH CHECK (public.is_club_member(club_id) AND uploaded_by = auth.uid());
