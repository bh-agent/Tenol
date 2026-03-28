-- Club Join Request System
-- Instead of immediately joining, users submit a request that admins/owners approve

CREATE TABLE IF NOT EXISTS public.club_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  responded_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  responded_at TIMESTAMPTZ,
  UNIQUE(club_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_club_join_requests_club ON club_join_requests(club_id, status);

ALTER TABLE club_join_requests ENABLE ROW LEVEL SECURITY;

-- Users can see own requests
CREATE POLICY "View own requests" ON club_join_requests FOR SELECT USING (auth.uid() = user_id);

-- Club admins can see all requests for their club
CREATE POLICY "Admins view club requests" ON club_join_requests FOR SELECT USING (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = club_join_requests.club_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Users can create their own requests
CREATE POLICY "Users can request" ON club_join_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can respond to requests
CREATE POLICY "Admins can respond" ON club_join_requests FOR UPDATE USING (
  EXISTS (SELECT 1 FROM club_members WHERE club_id = club_join_requests.club_id AND user_id = auth.uid() AND role IN ('owner', 'admin'))
);

-- Users can cancel their own pending requests
CREATE POLICY "Users can cancel own" ON club_join_requests FOR DELETE USING (auth.uid() = user_id);
