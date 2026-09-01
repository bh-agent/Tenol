-- 00050: 경기 상태 시간 기반 자동 전환 (수동 시작/종료 버튼 대체)
-- 경기 페이지 로드 시 호출되는 RPC. 시간 검증을 DB(KST 기준)에서 하므로
-- 클라이언트가 임의로 상태를 조작할 수 없다. 자정 크론은 안전망으로 유지.
--  - upcoming + 시작시간 경과 → in_progress
--  - 날짜 지남 또는 종료시간 경과 → completed
CREATE OR REPLACE FUNCTION public.sync_match_status(p_match_id UUID)
RETURNS TEXT AS $$
DECLARE
  m RECORD;
  now_kst TIMESTAMP;
  new_status TEXT := NULL;
BEGIN
  SELECT id, status, match_date, start_time, end_time
    INTO m FROM public.matches WHERE id = p_match_id;
  IF m.id IS NULL THEN RETURN NULL; END IF;
  IF m.status NOT IN ('upcoming', 'in_progress') THEN RETURN m.status; END IF;

  now_kst := (now() AT TIME ZONE 'Asia/Seoul');

  IF m.match_date < now_kst::date
     OR (m.end_time IS NOT NULL AND (m.match_date + m.end_time) <= now_kst) THEN
    new_status := 'completed';
  ELSIF m.status = 'upcoming'
        AND m.start_time IS NOT NULL
        AND (m.match_date + m.start_time) <= now_kst THEN
    new_status := 'in_progress';
  END IF;

  IF new_status IS NOT NULL THEN
    UPDATE public.matches
       SET status = new_status, updated_at = now()
     WHERE id = m.id;
    RETURN new_status;
  END IF;
  RETURN m.status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.sync_match_status(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_match_status(UUID) TO authenticated;
