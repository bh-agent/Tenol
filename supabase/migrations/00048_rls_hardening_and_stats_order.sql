-- 00048: RLS 권한상승 차단 + player_game_stats 결정적 정렬 컬럼
-- 감사(audit)에서 발견된 마이그레이션 3건. 정상 흐름을 깨지 않는 최소 변경.

-- ============================================================
-- 1) club_members INSERT — 권한 상승 차단
--    기존 "Users can join clubs"는 WITH CHECK (user_id = auth.uid()) 뿐이라
--    비멤버가 아무 클럽에 {role:'owner'} 행을 self-insert 해 회장을 탈취할 수 있었다.
--    정상 가입(role='member')과 "클럽 생성자의 owner 자동등록"만 허용한다.
-- ============================================================
DROP POLICY IF EXISTS "Users can join clubs" ON public.club_members;
CREATE POLICY "Users can join clubs" ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND (
      role = 'member'
      OR (
        role = 'owner'
        AND EXISTS (
          SELECT 1 FROM public.clubs c
          WHERE c.id = club_id AND c.created_by = auth.uid()
        )
      )
    )
  );

-- 관리자 멤버 추가(가입 승인 등)는 유지하되 owner 신설은 막는다.
-- 실제 코드의 관리자 insert는 role='member'뿐이고, owner 승계는 UPDATE 경로로만 처리된다.
DROP POLICY IF EXISTS "Admins can add members" ON public.club_members;
CREATE POLICY "Admins can add members" ON public.club_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_club_admin(club_id) AND role <> 'owner');

-- ============================================================
-- 2) match_participants INSERT — 익명 참가행 무단 삽입 차단
--    기존 "Can add participant"의 `user_id IS NULL` 조항은 임의의 인증 사용자가
--    아무 경기에 익명(오프라인 게스트) 행을 삽입할 수 있게 열려 있었다.
--    오프라인 게스트/대체 선수의 NULL user_id 삽입은 아래 "경기 생성자·클럽 관리자"
--    조항이 이미 커버하므로, 무제한 NULL 조항만 제거한다. (본인 참가·게스트 신청은 그대로)
-- ============================================================
DROP POLICY IF EXISTS "Can add participant" ON public.match_participants;
CREATE POLICY "Can add participant" ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id))
    )
  );

-- ============================================================
-- 3) player_game_stats 뷰 — 최장 연승 결정적 계산용 정렬 키 노출
--    기존 뷰는 match_date(DATE)만 있어 같은 날/같은 경기의 게임 순서가 비결정적이라
--    연승 계산이 흔들렸다. 경기 내 순서 키를 뷰 끝에 '추가'한다.
--    (CREATE OR REPLACE VIEW 규칙상 기존 컬럼 순서는 그대로 두고 뒤에만 덧붙임)
-- ============================================================
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
    WHEN (g.team_a_player1_id = mp.id OR g.team_a_player2_id = mp.id)
      AND g.winner = 'team_a' THEN 'win'
    WHEN (g.team_b_player1_id = mp.id OR g.team_b_player2_id = mp.id)
      AND g.winner = 'team_b' THEN 'win'
    WHEN g.winner IS NOT NULL THEN 'loss'
    ELSE NULL
  END AS result,
  CASE
    WHEN g.team_a_player1_id = mp.id OR g.team_a_player2_id = mp.id THEN 'team_a'
    ELSE 'team_b'
  END AS team,
  -- ↓↓↓ 신규 컬럼(뷰 끝에 추가) — 결정적 정렬용
  g.court_number,
  g.game_order,
  g.completed_at,
  g.created_at AS game_created_at
FROM public.match_participants mp
JOIN public.games g ON (
  g.team_a_player1_id = mp.id OR g.team_a_player2_id = mp.id
  OR g.team_b_player1_id = mp.id OR g.team_b_player2_id = mp.id
)
JOIN public.draws d ON g.draw_id = d.id
JOIN public.matches m ON d.match_id = m.id
WHERE mp.user_id IS NOT NULL;
