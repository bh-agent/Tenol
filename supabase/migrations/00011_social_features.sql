-- ============================================================
-- SOCIAL FEATURES: Likes, Comments
-- ============================================================

-- ============================================================
-- MEDIA_LIKES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(media_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_media_likes_media ON public.media_likes(media_id);

-- ============================================================
-- MEDIA_COMMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.media_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES public.media(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_comments_media_created ON public.media_comments(media_id, created_at);

-- ============================================================
-- feed_type column (may already exist from migration 00003)
-- ============================================================
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS feed_type TEXT DEFAULT 'club';

-- ============================================================
-- VIEW: media_with_counts
-- ============================================================
CREATE OR REPLACE VIEW public.media_with_counts AS
SELECT
  m.*,
  COALESCE(lc.like_count, 0) AS like_count,
  COALESCE(cc.comment_count, 0) AS comment_count
FROM public.media m
LEFT JOIN (
  SELECT media_id, COUNT(*) AS like_count
  FROM public.media_likes
  GROUP BY media_id
) lc ON m.id = lc.media_id
LEFT JOIN (
  SELECT media_id, COUNT(*) AS comment_count
  FROM public.media_comments
  GROUP BY media_id
) cc ON m.id = cc.media_id;

-- ============================================================
-- RLS: media_likes
-- ============================================================
ALTER TABLE public.media_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Likes viewable by authenticated"
  ON public.media_likes
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own likes"
  ON public.media_likes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own likes"
  ON public.media_likes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- RLS: media_comments
-- ============================================================
ALTER TABLE public.media_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments viewable by authenticated"
  ON public.media_comments
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own comments"
  ON public.media_comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments or media owner can delete"
  ON public.media_comments
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.media m
      WHERE m.id = media_id AND m.uploaded_by = auth.uid()
    )
  );
