CREATE TABLE IF NOT EXISTS public.recruitment_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  type TEXT NOT NULL CHECK (type IN ('member_recruit', 'guest_recruit')),
  title TEXT NOT NULL,
  description TEXT,
  -- For guest_recruit
  match_date DATE,
  location TEXT,
  needed_count INT,
  ntrp_min NUMERIC(2,1),
  ntrp_max NUMERIC(2,1),
  -- Common
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recruitment_club ON recruitment_posts(club_id);
CREATE INDEX IF NOT EXISTS idx_recruitment_type ON recruitment_posts(type, status);
ALTER TABLE recruitment_posts ENABLE ROW LEVEL SECURITY;

-- Everyone can see open recruitment posts
CREATE POLICY "View open posts" ON recruitment_posts FOR SELECT USING (status = 'open' OR created_by = auth.uid());
-- Club admins can create
CREATE POLICY "Create post" ON recruitment_posts FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = recruitment_posts.club_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);
-- Creator can update/delete
CREATE POLICY "Manage own" ON recruitment_posts FOR ALL USING (created_by = auth.uid());
