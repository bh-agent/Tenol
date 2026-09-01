-- 00052: player_game_stats 뷰 성능 재작성 (Disk IO 경고 대응)
--
-- 기존 뷰는 games ⨝ match_participants 를 "4개 플레이어 컬럼 OR" 조건으로 조인해
-- 인덱스를 탈 수 없는 준-크로스조인이었다 (클럽 통계 1회 조회 = 4,519 블록).
-- LATERAL VALUES 로 슬롯을 행으로 펼친 뒤 mp.id(PK) 동등 조인으로 바꾸면
-- 동일한 결과를 33블록에 낸다 (실측 137배 감소, 양방향 EXCEPT diff 0 검증).
-- 컬럼 이름/순서/타입은 기존과 동일하게 유지 (CREATE OR REPLACE 요건).
CREATE OR REPLACE VIEW public.player_game_stats AS
SELECT
  mp.user_id,
  g.id AS game_id,
  g.draw_id,
  d.match_id,
  m.club_id,
  m.match_date,
  g.score_team_a,
  g.score_team_b,
  CASE
    WHEN s.team = 'team_a' AND g.winner = 'team_a' THEN 'win'
    WHEN s.team = 'team_b' AND g.winner = 'team_b' THEN 'win'
    WHEN g.winner IS NOT NULL THEN 'loss'
    ELSE NULL
  END AS result,
  s.team,
  g.court_number,
  g.game_order,
  g.completed_at,
  g.created_at AS game_created_at
FROM public.games g
CROSS JOIN LATERAL (VALUES
  (g.team_a_player1_id, 'team_a'),
  (g.team_a_player2_id, 'team_a'),
  (g.team_b_player1_id, 'team_b'),
  (g.team_b_player2_id, 'team_b')
) AS s(participant_id, team)
JOIN public.match_participants mp ON mp.id = s.participant_id
JOIN public.draws d ON g.draw_id = d.id
JOIN public.matches m ON d.match_id = m.id
WHERE mp.user_id IS NOT NULL;
