# 푸시 알림 설정 가이드

테놀의 푸시 알림은 **FCM(Firebase Cloud Messaging) HTTP v1** 기반입니다.
코드는 모두 구현되어 있으며, 아래 환경 변수만 설정하면 자동으로 활성화됩니다.
**환경 변수가 없으면 푸시는 안전하게 비활성(no-op)** 되고 인앱 알림만 동작합니다.

## 동작 구조

```
경기/대진표/신청 이벤트
   → createNotification()  (notifications 테이블에 인앱 알림 저장)
       → sendPushToUser()  (device_tokens 조회 → FCM v1 발송, fire-and-forget)
네이티브 앱(NativeInit)
   → 앱 시작 시 푸시 권한 요청 + 토큰 발급
       → saveDeviceToken()  (device_tokens 테이블에 upsert)
   → 알림 탭 시 관련 경기/클럽 화면으로 이동
```

## 1. DB 마이그레이션 실행

Supabase SQL Editor에서 실행:

```
supabase/migrations/00039_device_tokens.sql
```

## 2. Firebase 프로젝트 준비

1. https://console.firebase.google.com 에서 프로젝트 생성(또는 기존 사용)
2. **Android**: `google-services.json` 다운로드 → `android/app/google-services.json` 에 배치
3. **iOS**: APNs 인증 키(.p8)를 Firebase 콘솔 → 프로젝트 설정 → Cloud Messaging → Apple 앱 구성에 업로드
4. **서비스 계정 키 발급**: 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성" → JSON 다운로드

## 3. 환경 변수 설정 (Vercel)

다운로드한 서비스 계정 JSON에서 값을 추출해 Vercel 환경 변수에 등록:

| 환경 변수 | JSON 필드 | 비고 |
|---|---|---|
| `FCM_PROJECT_ID` | `project_id` | |
| `FCM_CLIENT_EMAIL` | `client_email` | |
| `FCM_PRIVATE_KEY` | `private_key` | 줄바꿈은 `\n` 그대로 붙여넣어도 됨(코드가 자동 복원) |

> 셋 중 하나라도 비어 있으면 `isPushConfigured()`가 false가 되어 푸시 발송을 건너뜁니다.

## 4. 반복 경기 자동 생성 cron (선택)

`vercel.json`에 매일 00:00 KST(15:00 UTC) cron이 등록되어 있습니다.
보안을 위해 Vercel 환경 변수에 `CRON_SECRET`(임의 문자열)을 설정하세요.
Vercel Cron은 이 값을 `Authorization: Bearer ...` 헤더로 자동 전송합니다.

| 환경 변수 | 용도 |
|---|---|
| `CRON_SECRET` | `/api/cron/generate-matches` 인증 |
| `SUPABASE_SERVICE_ROLE_KEY` | cron/푸시의 RLS 우회 (이미 사용 중) |

## 5. iOS/Android 네이티브 권한

- **iOS**: Xcode → Signing & Capabilities → **Push Notifications** capability 추가
  (Background Modes → Remote notifications도 권장)
- **Android**: `@capacitor/push-notifications`가 자동으로 권한을 처리 (Android 13+는 런타임 권한 요청)

## 검증

1. 환경 변수 설정 후 배포
2. 네이티브 앱 실행 → 푸시 권한 허용 → `device_tokens` 테이블에 토큰이 저장되는지 확인
3. 다른 사용자가 내 게시물에 좋아요/댓글 또는 내가 참가한 경기에 점수 입력 → 푸시 수신 확인
4. 무효 토큰(앱 삭제 등)은 발송 실패 시 자동으로 `device_tokens`에서 정리됩니다
