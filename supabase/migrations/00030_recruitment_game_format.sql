-- Add game_format column to recruitment_posts for guest recruit
ALTER TABLE public.recruitment_posts
  ADD COLUMN IF NOT EXISTS game_format TEXT CHECK (game_format IN ('doubles', 'singles', 'mixed_doubles'));
