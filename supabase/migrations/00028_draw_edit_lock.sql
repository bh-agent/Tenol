-- 대진표 동시 편집 방지를 위한 잠금 테이블
CREATE TABLE IF NOT EXISTS public.draw_edit_locks (
  match_id UUID PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name TEXT
);

ALTER TABLE public.draw_edit_locks ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read locks
CREATE POLICY "Locks viewable" ON public.draw_edit_locks
  FOR SELECT TO authenticated USING (true);

-- Anyone authenticated can manage locks (server actions handle logic)
CREATE POLICY "Lock management" ON public.draw_edit_locks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
