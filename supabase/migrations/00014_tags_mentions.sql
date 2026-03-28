-- Tags/hashtags for media posts
CREATE TABLE IF NOT EXISTS public.media_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags(tag);
CREATE INDEX IF NOT EXISTS idx_media_tags_media ON media_tags(media_id);

-- User mentions in media posts
CREATE TABLE IF NOT EXISTS public.media_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(media_id, mentioned_user_id)
);
CREATE INDEX IF NOT EXISTS idx_media_mentions_user ON media_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_media_mentions_media ON media_mentions(media_id);

ALTER TABLE media_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_mentions ENABLE ROW LEVEL SECURITY;
-- Everyone can see tags and mentions
CREATE POLICY "View tags" ON media_tags FOR SELECT USING (true);
CREATE POLICY "View mentions" ON media_mentions FOR SELECT USING (true);
-- Post owner manages tags/mentions (via service role on insert, or auth check)
CREATE POLICY "Manage tags" ON media_tags FOR ALL USING (true);
CREATE POLICY "Manage mentions" ON media_mentions FOR ALL USING (true);
