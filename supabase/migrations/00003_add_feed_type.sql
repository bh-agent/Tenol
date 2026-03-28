ALTER TABLE public.media ADD COLUMN feed_type TEXT NOT NULL DEFAULT 'club' CHECK (feed_type IN ('club', 'personal'));
