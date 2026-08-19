-- 네이티브 로그인 세션 핸드오프용 비공개 스토리지 버킷.
--
-- 외부 브라우저에서 완료된 로그인 세션을 앱이 수령할 때까지 잠시(≤5분) 보관한다.
-- (src/lib/auth-handoff.ts — service_role 전용 접근)
--
-- 보안상 반드시 비공개여야 하며(리프레시 토큰 at-rest), RLS 정책을 만들지
-- 않으므로 anon/authenticated 키로는 접근 불가, service_role만 우회 접근한다.
-- 대시보드 설정 드리프트를 막기 위해 코드로 고정한다.
insert into storage.buckets (id, name, public)
values ('auth-handoff', 'auth-handoff', false)
on conflict (id) do update set public = false;
