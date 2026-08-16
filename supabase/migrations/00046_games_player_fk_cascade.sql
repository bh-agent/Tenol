-- ============================================================
-- 00046: games의 플레이어 FK에 ON DELETE CASCADE 추가
-- ============================================================
-- 문제: games.team_*_player*_id → match_participants FK에 삭제 동작이 없어(NO ACTION),
--   점수가 기록된 경기가 있는 경기/클럽을 삭제하면 참가자 CASCADE가 게임 참조에
--   막혀 23503(FK 위반)으로 실패함 (2026-08-16 실측: 중복 경기 정리 중 409 발생).
-- 안전성: 앱의 참가자 제외 로직(removeParticipant)은 삭제 전에 게임 참조를 먼저
--   정리하므로 이 CASCADE는 개별 제외 흐름에 영향 없음 — 경기/클럽 전체 삭제
--   경로에서만 작동한다.
-- ============================================================

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_team_a_player1_id_fkey,
  ADD CONSTRAINT games_team_a_player1_id_fkey
    FOREIGN KEY (team_a_player1_id) REFERENCES public.match_participants(id) ON DELETE CASCADE;

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_team_a_player2_id_fkey,
  ADD CONSTRAINT games_team_a_player2_id_fkey
    FOREIGN KEY (team_a_player2_id) REFERENCES public.match_participants(id) ON DELETE CASCADE;

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_team_b_player1_id_fkey,
  ADD CONSTRAINT games_team_b_player1_id_fkey
    FOREIGN KEY (team_b_player1_id) REFERENCES public.match_participants(id) ON DELETE CASCADE;

ALTER TABLE public.games
  DROP CONSTRAINT IF EXISTS games_team_b_player2_id_fkey,
  ADD CONSTRAINT games_team_b_player2_id_fkey
    FOREIGN KEY (team_b_player2_id) REFERENCES public.match_participants(id) ON DELETE CASCADE;

-- 검증: 4개 제약의 confdeltype이 'c'(CASCADE)여야 함
SELECT conname, confdeltype FROM pg_constraint
WHERE conrelid = 'public.games'::regclass AND contype = 'f' AND conname LIKE '%player%';
