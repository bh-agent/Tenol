-- 00051: 클럽 오픈채팅 링크 — 미가입자 문의 창구 (초대 페이지·클럽 탐색에 노출)
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS open_chat_url TEXT;
