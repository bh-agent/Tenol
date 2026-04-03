-- Match templates for recurring matches
CREATE TABLE IF NOT EXISTS public.match_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  title_pattern TEXT NOT NULL,
  description TEXT,
  location TEXT,
  start_time TIME,
  end_time TIME,
  court_count INT NOT NULL DEFAULT 1,
  max_participants INT,
  allow_guests BOOLEAN DEFAULT true,
  format TEXT DEFAULT 'doubles' CHECK (format IN ('doubles', 'singles', 'mixed_doubles')),
  day_of_week INT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  frequency_weeks INT NOT NULL DEFAULT 1 CHECK (frequency_weeks >= 1 AND frequency_weeks <= 4),
  is_active BOOLEAN DEFAULT true,
  last_created_date DATE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_templates_club ON public.match_templates(club_id);

ALTER TABLE public.match_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club members can read templates"
  ON public.match_templates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = match_templates.club_id
      AND club_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Club members can create templates"
  ON public.match_templates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = match_templates.club_id
      AND club_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Creator or admins can update"
  ON public.match_templates FOR UPDATE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = match_templates.club_id
      AND club_members.user_id = auth.uid()
      AND club_members.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Creator or admins can delete"
  ON public.match_templates FOR DELETE
  USING (
    created_by = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.club_members
      WHERE club_members.club_id = match_templates.club_id
      AND club_members.user_id = auth.uid()
      AND club_members.role IN ('owner', 'admin')
    )
  );
