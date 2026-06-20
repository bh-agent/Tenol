# 앱스토어/플레이스토어 제출 체크리스트 (2026)

이번 강화 작업으로 **앱 심사 통과를 막던 6개 차단 이슈**와 주요 보안/UX 문제를 수정했습니다.
이 문서는 **출시 전 직접 해야 하는 작업**(코드 외 설정)과 **기기 테스트 항목**을 정리합니다.

> 핵심: 네이티브 앱은 `server.url`로 **원격 사이트(Vercel)**를 로드합니다. 따라서 웹/JS/SQL 수정은
> `vercel --prod` 배포만으로 즉시 반영됩니다. **앱 재빌드가 필요한 것은 진짜 네이티브 부분뿐**입니다
> (Apple 로그인 플러그인·entitlements·AppDelegate·Info.plist·번들된 offline.html).

---

## 0. 코드로 이미 수정된 것 (배포만 하면 반영)

| 영역 | 수정 내용 |
|---|---|
| Apple 로그인 | 네이티브에서 ASAuthorization(네이티브 Sign in with Apple) 사용, 웹은 기존 팝업 유지, 실패 시 사용자에게 에러 표시 |
| 계정 삭제 | 클럽장 삭제 시 운영권 자동 위임/클럽 삭제 처리, FK 정리 |
| UGC 신고/차단 | 프로필·클럽에도 신고 메뉴 추가, 차단한 사용자 프로필 숨김 |
| 오프라인 | offline.html 재시도 버튼이 실제 앱으로 복귀하도록 수정 + 네이티브 번들에 포함 |
| 접근성 | 핀치 줌 허용(확대 가능), 점수 입력 버튼 44px, 오프라인 배너 세이프영역 |
| PWA | 네이티브 앱에서 서비스워커/"홈 화면에 추가" 배너 비활성(웹 전용) |
| 보안 | 권한 상승·알림 위조·로그 노출·로그 플러딩 차단 (SQL 마이그레이션 필요, 아래 1번) |
| 정합성 | 반복경기 cron 날짜를 KST 기준으로 계산 |

---

## 1. ⚠️ 필수: Supabase SQL 마이그레이션 실행

Supabase 대시보드 → **SQL Editor**에서 아래 파일을 **순서대로** 실행하세요.
모두 idempotent(여러 번 실행 안전)하게 작성했습니다.

1. `supabase/migrations/00040_account_deletion_fk_fix.sql` — **계정 삭제 차단 해소(필수)**
   - 클럽/경기/미디어 생성자 FK를 `ON DELETE SET NULL`로 변경. 이게 없으면 클럽·경기를 만든 사용자는 계정 삭제가 FK 오류로 실패합니다(애플 심사에서 직접 테스트하는 항목).
2. `supabase/migrations/00041_lock_privileged_profile_columns.sql` — **권한 상승 취약점 차단**
   - 일반 사용자가 `is_admin=true`로 자신을 관리자로 만들거나 정지를 해제하지 못하게 함.
3. `supabase/migrations/00042_notifications_insert_lockdown.sql` — **알림 위조 차단**
   - ⚠️ 앱 코드가 이미 service_role로 알림을 생성하도록 변경됨. **`SUPABASE_SERVICE_ROLE_KEY` 환경변수가 반드시 설정돼 있어야** 알림이 정상 동작합니다(이미 사용 중).
4. `supabase/migrations/00043_app_logs_rls_fix.sql` — **로그 노출/플러딩 차단**
   - 로그는 본인/관리자만 조회 가능. 서버 로깅은 service_role로 동작.

**실행 후 검증 쿼리:**
```sql
-- FK가 SET NULL로 바뀌었는지
SELECT conrelid::regclass AS tbl, conname, confdeltype  -- confdeltype 'n' = SET NULL
FROM pg_constraint WHERE contype='f' AND confrelid='public.profiles'::regclass;

-- 권한 트리거 존재 확인
SELECT tgname FROM pg_trigger WHERE tgrelid='public.profiles'::regclass AND tgname='trg_prevent_privilege_escalation';

-- 정책 확인
SELECT tablename, policyname, cmd FROM pg_policies
WHERE tablename IN ('notifications','app_logs','profiles') ORDER BY tablename;
```

> 권장: 가능하면 스테이징(또는 별도 프로젝트)에서 먼저 실행하고, 로그인·알림·계정삭제를 한 번 돌려보세요.

---

## 2. ⚠️ 필수: Supabase Apple 로그인 provider 설정

네이티브 Apple 로그인의 id_token은 **번들 ID(`app.tenol.club`)**를 audience로 사용합니다.
기존 웹 팝업은 Services ID(`app.tenol.club.service`)를 사용합니다. **둘 다 허용**해야 합니다.

Supabase 대시보드 → Authentication → Providers → **Apple** →
**Authorized Client IDs** (또는 audiences)에 아래 둘을 모두 추가:
```
app.tenol.club           ← 네이티브(iOS 앱)
app.tenol.club.service   ← 웹/PWA (기존)
```
이걸 안 하면 네이티브 로그인 시 토큰 audience 불일치로 로그인이 실패합니다.

---

## 3. iOS 빌드 (Mac + Xcode) — Apple 로그인/푸시 활성화

```bash
# 프로젝트 루트에서
npm install            # @capacitor-community/apple-sign-in 설치
npm run cap:sync       # ⚠️ 'npx cap sync'가 아니라 이 스크립트! (offline.html을 번들에 시드)
npx cap open ios
```

Xcode에서:
1. **Signing & Capabilities** 탭에서 다음 capability 추가(또는 확인):
   - **Sign in with Apple**
   - **Push Notifications**
   - (권장) Background Modes → **Remote notifications**
   - → 이때 `App/App.entitlements`가 자동 연결됩니다(이미 파일을 생성해 뒀고 pbxproj에 `CODE_SIGN_ENTITLEMENTS`도 연결해 둠).
2. **Apple Developer 포털**의 App ID(`app.tenol.club`)에서 **Sign in with Apple**과 **Push Notifications**를 활성화합니다(자동 서명이면 Xcode가 처리하기도 함).
3. 버전 올리기: `CURRENT_PROJECT_VERSION`(빌드 번호)과 `MARKETING_VERSION`을 이전 제출보다 높게.
4. 실기기에서 테스트(4번 항목).

> `npm run cap:sync`를 쓰는 이유: webDir(`out`)에 offline.html을 먼저 복사한 뒤 sync해야
> 네이티브 번들(`ios/App/App/public`, `android/.../assets/public`)에 offline.html이 들어갑니다.
> 그냥 `npx cap sync`를 쓰면 offline.html이 빠져 오프라인 시 빈 화면이 됩니다.

---

## 4. ⚠️ 출시 전 실기기 테스트 (제가 코드로 검증 못 하는 부분)

- [ ] **Apple 로그인** — 실제 아이폰에서 'Apple로 시작하기' → 로그인 성공 → /clubs 진입. (가장 중요. 3번 거절의 핵심)
- [ ] **계정 삭제** — 클럽을 만들고 + 경기를 만들고 + 가입신청을 처리한 계정으로 삭제 → 성공하고, 그 클럽의 운영권이 다른 멤버에게 넘어갔는지(또는 멤버 없으면 클럽 삭제) 확인.
- [ ] **오프라인** — 비행기모드로 앱 실행 → offline.html이 보이고 → 네트워크 복구 후 '다시 시도' 누르면 앱으로 복귀.
- [ ] 네이티브 앱에서 **"홈 화면에 추가" 배너가 안 뜨는지**, 화면이 오래된 채로 멈추지 않는지.
- [ ] **핀치 줌**이 되는지(확대 가능).
- [ ] 다른 사람 **프로필/클럽에서 신고·차단** 메뉴(⋯)가 보이고 동작하는지.
- [ ] 푸시 설정을 했다면(아래 5번) 알림 수신 확인.

---

## 5. 푸시 알림 (선택, 4.2 "최소 기능" 방어에 도움)

자세한 설정은 `docs/PUSH_SETUP.md` 참고. 이번에 iOS 네이티브 배선을 추가했습니다:
- `App.entitlements`(aps-environment), `Info.plist`(UIBackgroundModes: remote-notification),
  `AppDelegate.swift`(APNs 토큰 forwarding) 추가됨.

**⚠️ iOS 푸시 전달의 남은 결정 사항:** 현재 `@capacitor/push-notifications`는 iOS에서 **APNs 토큰**을 돌려주는데,
서버(`src/lib/push/fcm.ts`)는 **FCM v1**로 보냅니다. iOS로 실제 전달하려면 둘 중 하나가 필요합니다:
1. **Firebase 경로**: `GoogleService-Info.plist` + `@capacitor-firebase/messaging` 도입 → 플러그인이 FCM 토큰을 반환(서버 코드 그대로). 또는
2. **APNs 직접 발송**: 이미 있는 `AuthKey_*.p8`로 서버에서 APNs에 직접 발송(저장된 platform='ios'로 분기).

Android는 `google-services.json`만 넣으면 기존 FCM 경로로 동작합니다.

---

## 6. 배포 (웹 수정사항 반영)

```bash
vercel --prod --yes
vercel ls --prod   # 최신 배포 시각 확인
```
> Tenol은 Git 푸시로 자동배포되지 않습니다. 반드시 위 CLI로 배포하세요.
> 1·2번(Supabase)과 6번(Vercel)을 마치면 **웹/원격 부분의 모든 수정이 라이브에 반영**되고,
> 3번(iOS 재빌드)까지 마치면 네이티브 부분(로그인/오프라인/푸시)이 반영됩니다.

---

## 7. 알려진 후속 과제 (출시 차단 아님)

- **guest_phone 컬럼 프라이버시**: 게스트 전화번호가 인증 사용자에게 RLS로 노출될 수 있음(앱 UI에는 표시 안 함).
  Postgres 컬럼 권한은 "테이블 SELECT 회수 후 나머지 컬럼만 GRANT"로 해야 안전하므로, 스키마 변경 시 함께 검증 후 적용 권장.
- **iOS FCM 토큰 경로**(5번) 결정.
- **네이티브 스플래시 다크 이미지** 재생성(현재 흰 프레임이 잠깐 보일 수 있음): `npx @capacitor/assets generate`로 #0A0A0A 배경 재생성.
- **대진표 혼복 폴백**: 2남2녀가 아닐 때 'mixed'로 잘못 라벨될 수 있음 → 검증 강화 검토.
