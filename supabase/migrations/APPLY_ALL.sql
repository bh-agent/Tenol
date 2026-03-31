-- ============================================================
-- 테놀 (Tenol) - 전체 마이그레이션 통합 스크립트
-- Supabase SQL Editor에서 이 파일 내용을 실행하세요
-- ============================================================

-- 00018: Admin이 클럽 멤버를 추가할 수 있는 RLS 정책
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Admins can add members' AND tablename = 'club_members'
  ) THEN
    CREATE POLICY "Admins can add members" ON public.club_members
      FOR INSERT TO authenticated
      WITH CHECK (
        public.is_club_admin(club_id)
      );
  END IF;
END $$;

-- 00019: 모집글 성별 슬롯
ALTER TABLE public.recruitment_posts ADD COLUMN IF NOT EXISTS male_slots INTEGER;
ALTER TABLE public.recruitment_posts ADD COLUMN IF NOT EXISTS female_slots INTEGER;
ALTER TABLE public.recruitment_posts ADD COLUMN IF NOT EXISTS any_slots INTEGER;

-- 00020: 가입/게스트 신청 자기소개
ALTER TABLE public.club_join_requests ADD COLUMN IF NOT EXISTS introduction TEXT;
ALTER TABLE public.match_participants ADD COLUMN IF NOT EXISTS introduction TEXT;

-- 00021: 프로필 실명
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS real_name TEXT;

-- 00022: 모집 마감 플래그
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS registration_closed BOOLEAN DEFAULT false;

-- 00023: 게스트 접근 RLS 정책 수정
-- 게스트 허용 경기를 비멤버도 볼 수 있게
DROP POLICY IF EXISTS "Matches viewable by club members" ON public.matches;
DROP POLICY IF EXISTS "Matches viewable by club members or guests" ON public.matches;
CREATE POLICY "Matches viewable by club members or guests" ON public.matches
  FOR SELECT TO authenticated USING (
    public.is_club_member(club_id) OR allow_guests = true
  );

DROP POLICY IF EXISTS "Participants viewable" ON public.match_participants;
CREATE POLICY "Participants viewable" ON public.match_participants
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (public.is_club_member(m.club_id) OR m.allow_guests = true)
    )
  );

-- RPC 함수: join_match_atomically (최종 버전)
-- registration_closed 체크 + introduction 지원 + MATCH_NOT_FOUND 체크
CREATE OR REPLACE FUNCTION public.join_match_atomically(
  p_match_id UUID,
  p_user_id UUID,
  p_participant_type TEXT DEFAULT 'member',
  p_status TEXT DEFAULT 'confirmed',
  p_guest_name TEXT DEFAULT NULL,
  p_guest_phone TEXT DEFAULT NULL,
  p_guest_gender TEXT DEFAULT NULL,
  p_ntrp_override NUMERIC(2,1) DEFAULT NULL,
  p_introduction TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed BOOLEAN;
  v_participant_id UUID;
BEGIN
  SELECT registration_closed INTO v_closed
  FROM matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND';
  END IF;

  IF v_closed = true THEN
    RAISE EXCEPTION 'REGISTRATION_CLOSED';
  END IF;

  INSERT INTO match_participants (
    match_id, user_id, participant_type, status,
    guest_name, guest_phone, guest_gender, ntrp_override, introduction
  ) VALUES (
    p_match_id, p_user_id, p_participant_type, p_status,
    p_guest_name, p_guest_phone, p_guest_gender, p_ntrp_override, p_introduction
  )
  RETURNING id INTO v_participant_id;

  RETURN v_participant_id;
END;
$$;

-- 00024: 관리자가 다른 유저의 참가자를 추가할 수 있도록 INSERT 정책 확장
-- (대체 선수 교체, 운영진이 참가자 직접 추가 등)
DROP POLICY IF EXISTS "Can add participant" ON public.match_participants;
CREATE POLICY "Can add participant" ON public.match_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND (m.created_by = auth.uid() OR public.is_club_admin(m.club_id))
    )
  );

-- 00026: Public read access for authenticated users
-- 비멤버도 클럽 정보, 멤버 목록, 피드를 볼 수 있도록 SELECT 정책 개방
DROP POLICY IF EXISTS "Public clubs viewable by all" ON public.clubs;
DROP POLICY IF EXISTS "Clubs viewable by authenticated" ON public.clubs;
CREATE POLICY "Clubs viewable by authenticated" ON public.clubs
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Members viewable by club members" ON public.club_members;
DROP POLICY IF EXISTS "Members viewable by authenticated" ON public.club_members;
CREATE POLICY "Members viewable by authenticated" ON public.club_members
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Media viewable by club members" ON public.media;
DROP POLICY IF EXISTS "Media viewable by authenticated" ON public.media;
CREATE POLICY "Media viewable by authenticated" ON public.media
  FOR SELECT TO authenticated USING (true);

-- 00028: 대진표 동시 편집 방지 잠금 테이블
CREATE TABLE IF NOT EXISTS public.draw_edit_locks (
  match_id UUID PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  locked_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name TEXT
);

ALTER TABLE public.draw_edit_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Locks viewable" ON public.draw_edit_locks;
CREATE POLICY "Locks viewable" ON public.draw_edit_locks
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Lock management" ON public.draw_edit_locks;
CREATE POLICY "Lock management" ON public.draw_edit_locks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
