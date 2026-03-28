-- 다중 파일 지원: file_urls JSONB 컬럼 추가
-- 형식: [{"url": "https://...", "type": "image"}, ...]
ALTER TABLE public.media ADD COLUMN file_urls JSONB DEFAULT '[]';

-- 기존 단일 file_url 데이터를 file_urls로 마이그레이션
UPDATE public.media
SET file_urls = jsonb_build_array(jsonb_build_object('url', file_url, 'type', file_type))
WHERE file_url IS NOT NULL AND (file_urls IS NULL OR file_urls = '[]'::jsonb);

NOTIFY pgrst, 'reload schema';
