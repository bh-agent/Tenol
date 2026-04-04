-- 템플릿 제목 형식 컬럼 추가 (자동 생성용)
-- 'name_only' = 이름만, 'with_date' = 이름 + 날짜, 'with_round' = 이름 + 회차
ALTER TABLE public.match_templates
  ADD COLUMN IF NOT EXISTS title_format TEXT DEFAULT 'with_date';
