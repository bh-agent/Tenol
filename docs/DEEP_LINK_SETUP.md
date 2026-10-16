# 공유 링크 → 앱 바로 열기 (유니버설 링크 / 앱 링크) 설정

작성일: 2026-10-16

## 동작 방식

공유 링크는 그대로 `https://tenol-one.vercel.app/clubs/...` 웹 주소다. 추가 설정을 마치면 OS가 이 주소를 앱 소유로 인식해서:

- **앱이 설치돼 있으면** 브라우저 대신 앱이 열리고, 앱 안에서 그 화면(경기 상세 등)으로 이동한다. (`native-init.tsx`의 `appUrlOpen` 처리)
- **앱이 없으면** 모바일 웹이 열리고 상단에 "앱 받기" 띠 배너가 뜬다. (`open-in-app-banner.tsx`)
- 데스크톱·앱 안에서는 배너가 뜨지 않는다.

대상 경로: `/clubs/*`, `/recruit*`, `/profile/*`, `/my-matches`, `/notifications`. `/auth/*`, `/login`은 제외(외부 브라우저 OAuth 흐름을 앱이 가로채면 로그인이 깨진다).

## 코드에 이미 반영된 것

| 항목 | 파일 |
|---|---|
| iOS 연결 파일 (Team ID `U73UP8WL5G`, 번들 `app.tenol.club`) | `public/.well-known/apple-app-site-association` + `vercel.json`의 Content-Type 헤더 |
| Android 연결 파일 (SHA-256 **채워야 함**) | `public/.well-known/assetlinks.json` |
| 미들웨어가 `.well-known`을 로그인 리다이렉트에서 제외 | `middleware.ts` |
| Android 인텐트 필터 (`autoVerify`) | `android/app/src/main/AndroidManifest.xml` |
| iOS Associated Domains 엔타이틀먼트 | `ios/App/App/App.entitlements` |
| 앱 안 라우팅 (콜드 스타트 포함) | `src/components/native/native-init.tsx` |
| 앱 받기 배너 | `src/components/native/open-in-app-banner.tsx` (경기 상세·클럽 홈) |
| 링크 미리보기 이미지 1200×630 | `src/app/opengraph-image.tsx` |

## 직접 해야 하는 것

### 1. Android: Play 앱 서명 인증서 SHA-256 입력

1. Play Console → 앱 선택 → **설정 → 앱 무결성(App integrity)** → **앱 서명 키 인증서**의 **SHA-256 인증서 지문** 복사.
   (Play 앱 서명을 쓰고 있으므로 로컬 `tenol-release.jks`의 지문이 아니라 **Play가 배포에 쓰는 키**의 지문이어야 한다. 내부 테스트용으로 로컬 키 서명 APK도 쓰면 그 지문도 배열에 같이 넣는다.)
2. `public/.well-known/assetlinks.json`의 `REPLACE_WITH_PLAY_APP_SIGNING_SHA256`를 그 값(콜론 포함 대문자 형식 `AA:BB:...`)으로 교체.
3. 배포(`vercel --prod`). 확인: `https://tenol-one.vercel.app/.well-known/assetlinks.json`이 JSON으로 열려야 한다.
4. Android 앱을 **재빌드해서 설치**(인텐트 필터가 바뀌었으므로). 설치 후 OS가 자동 검증한다(몇 초~몇 분). 확인 명령:
   ```
   adb shell pm get-app-links app.tenol.club
   ```
   `tenol-one.vercel.app: verified`면 완료.

### 2. iOS: Associated Domains 켜기 + 재빌드 (Mac)

1. Apple Developer → Identifiers → `app.tenol.club` → **Associated Domains** 체크 → Save.
2. Xcode에서 프로젝트 열기 → Signing & Capabilities → **+ Capability → Associated Domains**가 엔타이틀먼트 파일의 `applinks:tenol-one.vercel.app`와 함께 보이는지 확인. (자동 서명이면 프로비저닝 프로파일이 자동 갱신됨)
3. 아카이브 → 업로드. 새 빌드를 설치해야 iOS가 `/.well-known/apple-app-site-association`를 받아 간다.
4. 확인: 메모 앱에 `https://tenol-one.vercel.app/clubs` 링크를 적고 길게 눌러 "테놀에서 열기"가 나오면 완료.

### 3. iOS 앱 받기 배너 (App Store 등록 후)

Vercel 환경변수 두 개를 추가하고 재배포한다.

| 변수 | 값 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_APP_STORE_URL` | `https://apps.apple.com/kr/app/id<숫자>` | 모바일 웹 "앱 받기" 배너의 iOS 링크 |
| `NEXT_PUBLIC_APP_STORE_ID` | `<숫자>` | Safari 스마트 앱 배너 |

설정 전까지 iOS 웹에서는 배너가 뜨지 않는다(Android는 바로 뜬다).

### 4. 카카오톡 미리보기가 옛 이미지로 보일 때

카카오는 URL별 미리보기를 오래 캐시한다. 이미지·제목을 바꿔도 이전에 공유된 적 있는 URL은 예전 것이 보인다.
https://developers.kakao.com/tool/clear/og 에서 해당 URL을 넣고 캐시를 지우면 새 이미지(1200×630)로 바뀐다.

## 참고: 도메인을 바꾸면

커스텀 도메인(예: `tenol.club`)으로 옮기면 위 파일들의 `tenol-one.vercel.app`를 모두 바꾸고 두 앱을 다시 빌드해야 한다. 대상: `AndroidManifest.xml`, `App.entitlements`, `capacitor.config.ts`(server.url), 그리고 `.well-known` 파일은 새 도메인에서 서빙.
