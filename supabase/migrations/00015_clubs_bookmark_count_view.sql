-- View: clubs with bookmark count for explore page sorting
CREATE OR REPLACE VIEW public.clubs_with_bookmark_count AS
SELECT
  c.*,
  COALESCE(b.bookmark_count, 0)::int AS bookmark_count
FROM public.clubs c
LEFT JOIN (
  SELECT club_id, COUNT(*)::int AS bookmark_count
  FROM public.club_bookmarks
  GROUP BY club_id
) b ON b.club_id = c.id;
