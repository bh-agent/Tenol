-- Add gendered slot columns to recruitment_posts
ALTER TABLE recruitment_posts
  ADD COLUMN IF NOT EXISTS male_slots INTEGER,
  ADD COLUMN IF NOT EXISTS female_slots INTEGER,
  ADD COLUMN IF NOT EXISTS any_slots INTEGER;
