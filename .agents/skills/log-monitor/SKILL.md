---
name: log-monitor
description: Supabase app_logs 테이블에서 에러/경고 로그를 조회하고, 문제를 분석하여 코드를 수정한 뒤 커밋·푸시까지 자동 수행한다. "로그 확인해줘", "에러 수정해줘", "프로덕션 문제 봐줘", "모니터링", "로그 분석", "에러 로그" 같은 요청에 사용한다. /loop과 함께 주기적 자동 모니터링에도 사용한다.
---

# Log Monitor & Auto-Fix

프로덕션 앱의 로그를 조회하고, 발견된 문제를 분석·수정·배포하는 워크플로우.

## 워크플로우

### 1단계: 로그 수집

Supabase `app_logs` 테이블에서 로그를 가져온다. `/api/logs` GET 엔드포인트를 활용하거나 Supabase 클라이언트로 직접 쿼리한다.

```bash
# 최근 에러 로그 (기본)
curl -s "https://tenol-one.vercel.app/api/logs?level=error&limit=50"

# 경고 포함
curl -s "https://tenol-one.vercel.app/api/logs?level=warn&limit=30"

# 특정 카테고리
curl -s "https://tenol-one.vercel.app/api/logs?category=match&limit=30"

# 특정 날짜 이후
curl -s "https://tenol-one.vercel.app/api/logs?level=error&since=2026-04-03"
```

또는 Supabase SQL로 직접 조회:
```sql
SELECT level, category, message, error_name, error_stack, path, user_id, created_at
FROM app_logs
WHERE level IN ('error', 'warn')
ORDER BY created_at DESC
LIMIT 50;
```

### 2단계: 로그 분석

수집한 로그를 분석하여 분류한다:

- **반복 에러**: 같은 message 3회 이상 → 구조적 문제, 우선 수정
- **신규 에러**: 최근 24시간 내 처음 발생 → 배포 회귀 가능성
- **클라이언트 에러** (category=client): error.tsx에서 보고 → UI/렌더링 문제
- **서버 에러** (category=match,club,draw 등): 서버 액션 실패 → 로직/DB 문제
- **인증 에러** (category=auth): 권한/세션 문제
- **무시 가능**: 일회성 네트워크 에러, 사용자 입력 오류 등

분석 결과를 긴급/주의/무시 3단계로 보고한다.

### 3단계: 코드 수정

분석된 문제별로:

1. **관련 파일 읽기** — error_stack이나 path에서 파일 위치 파악
2. **원인 진단** — 코드를 읽고 에러 원인 확인
3. **수정 적용** — 최소한의 변경으로 문제 해결
4. **빌드 확인** — `npm run build` 통과 여부 확인

수정 원칙:
- 한 번에 하나의 이슈만 수정 (작은 커밋 단위)
- 기존 동작을 바꾸지 않는 방어적 수정 우선
- 타입 에러, null 체크 누락, 비동기 처리 문제를 먼저 확인
- 수정이 불확실하면 logWarn을 추가하여 다음 모니터링에서 추적

### 4단계: 커밋 & 푸시

```
fix(<category>): <간결한 설명>

로그에서 발견된 에러 수정:
- <구체적 수정 내용>

Detected from app_logs: <에러 message 요약>

Co-Authored-By: Codex Opus 4.6 (1M context) <noreply@anthropic.com>
```

### 5단계: 결과 보고

조회 기간, 총 로그 수, 수정 완료 항목, 모니터링 필요 항목, 정상 여부를 보고한다.

## loop 모드

`/loop` 기능과 함께 주기적 자동 모니터링:
```
/loop 10m /log-monitor
```

매 주기마다: 로그 수집 → 분석 → 문제 시 수정+커밋+푸시 → 보고. 문제 없으면 "이상 없음"으로 짧게 보고한다.
