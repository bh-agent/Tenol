-- 00053: 클럽 인스타그램 링크 (오픈채팅과 동일 패턴 — 클럽 홈·초대·탐색에 노출)
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS instagram_url TEXT;
