CREATE TABLE IF NOT EXISTS public.club_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, club_id)
);
CREATE INDEX IF NOT EXISTS idx_club_bookmarks_user ON club_bookmarks(user_id);
ALTER TABLE club_bookmarks ENABLE ROW LEVEL SECURITY;
-- RLS: users can see/manage own bookmarks
CREATE POLICY "View own bookmarks" ON club_bookmarks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Add bookmark" ON club_bookmarks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Remove bookmark" ON club_bookmarks FOR DELETE USING (auth.uid() = user_id);
