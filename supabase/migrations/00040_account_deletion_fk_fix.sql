-- ============================================================
-- 00040: 계정 삭제 시 FK 위반 방지 (Apple 5.1.1(v) 대응)
-- ============================================================
-- 문제: clubs/matches/draws/media/recruitment_posts/match_templates의
--   created_by(또는 uploaded_by)가 profiles(id)를 NOT NULL + ON DELETE 규칙 없이
--   참조한다. 따라서 클럽/경기 등을 한 번이라도 만든 사용자는 계정 삭제 시
--   profiles 삭제가 FK 위반(23503)으로 실패하고, auth.users도 지워지지 않는다.
--
-- 해결: 생성자 참조 FK를 ON DELETE SET NULL로 바꾸고 해당 컬럼을 nullable로 변경.
--   → 과거 클럽/경기/미디어 기록은 남되 생성자 포인터만 NULL이 된다.
--   (클럽 운영권은 앱의 계정 삭제 라우트에서 다른 멤버에게 위임/삭제 처리)
--
-- 안전성: 실제 FK 제약 이름을 카탈로그에서 찾아 드롭하므로 이름이 달라도 동작한다.
--   여러 번 실행해도 안전(idempotent). 존재하지 않는 테이블/컬럼은 건너뛴다.
-- ============================================================

DO $$
DECLARE
  pairs text[][] := ARRAY[
    ARRAY['clubs', 'created_by'],
    ARRAY['matches', 'created_by'],
    ARRAY['draws', 'created_by'],
    ARRAY['media', 'uploaded_by'],
    ARRAY['recruitment_posts', 'created_by'],
    ARRAY['match_templates', 'created_by'],
    ARRAY['match_participants', 'responded_by'],
    ARRAY['club_join_requests', 'responded_by']
  ];
  i int;
  tbl text;
  col text;
  fk_name text;
  rel_oid oid;
BEGIN
  FOR i IN 1 .. array_length(pairs, 1) LOOP
    tbl := pairs[i][1];
    col := pairs[i][2];

    -- 테이블/컬럼이 없으면 건너뜀
    SELECT c.oid INTO rel_oid
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = tbl;
    IF rel_oid IS NULL THEN CONTINUE; END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_attribute
      WHERE attrelid = rel_oid AND attname = col AND attnum > 0 AND NOT attisdropped
    ) THEN CONTINUE; END IF;

    -- 해당 컬럼의 FK 제약 이름 조회 (단일 컬럼 FK 가정)
    SELECT con.conname INTO fk_name
    FROM pg_constraint con
    WHERE con.contype = 'f'
      AND con.conrelid = rel_oid
      AND con.conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid = rel_oid AND attname = col)]
    LIMIT 1;

    -- 기존 FK 드롭
    IF fk_name IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, fk_name);
    END IF;

    -- 컬럼을 nullable로 (이미 nullable이면 무해)
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', tbl, col);

    -- ON DELETE SET NULL로 재생성
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
      tbl, tbl || '_' || col || '_fkey', col
    );

    fk_name := NULL;
  END LOOP;
END $$;

-- PostgREST 스키마 캐시 리로드
NOTIFY pgrst, 'reload schema';
