-- 00049: 코트 이름을 매치에 저장 (대진 생성 후에도 편집·유지 가능하도록)
-- 형태: {"1":"A코트","2":"센터코트", ...} (코트 번호 → 이름). null이면 기본값 "N코트".
-- UPDATE 권한은 기존 matches 정책(생성자·클럽 관리자)으로 커버되므로 별도 정책 불필요.
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS court_names JSONB;
