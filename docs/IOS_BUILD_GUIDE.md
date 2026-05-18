# iOS 빌드 가이드 (Mac에서 실행)

## 개요
이 가이드는 Mac에서 Tenol iOS 앱을 빌드하고 App Store에 제출하는 전체 과정입니다.
Claude Code에게 이 파일을 전달하면 단계별로 진행할 수 있습니다.

## 사전 조건
- macOS + Xcode 최신 버전 설치
- Apple Developer 계정 로그인 (Xcode → Settings → Accounts)
- Team ID: U73UP8WL5G
- Bundle ID: app.tenol.club
- Git 설치

---

## STEP 1: 프로젝트 가져오기

```bash
git clone https://github.com/bh-agent/Tenol.git
cd Tenol
npm install
npx cap sync ios
```

---

## STEP 2: 앱 아이콘 준비

현재 iOS 아이콘이 기본 Capacitor 아이콘(placeholder)으로 되어있어 Apple 심사에서 거절됨.
테놀 아이콘으로 교체해야 함.

### 방법 1: Xcode Image Asset으로 교체
1. `npx cap open ios` 실행 → Xcode 열림
2. 좌측 패널 → `App` → `Assets.xcassets` → `AppIcon`
3. 현재 있는 아이콘 삭제
4. `public/icons/icon-512.png` 파일을 1024x1024로 리사이즈 (또는 그대로 사용)
5. 1024x1024 슬롯에 드래그

### 방법 2: AppIcon Generator 사용 (권장)
1. https://appicon.co 접속
2. `public/icons/icon-512.png` 업로드
3. **iPhone** 체크 → Generate
4. 다운로드된 `AppIcon.appiconset` 폴더를
   `ios/App/App/Assets.xcassets/AppIcon.appiconset` 에 덮어쓰기
5. Xcode에서 확인

---

## STEP 3: Xcode 프로젝트 설정

```bash
npx cap open ios
```

Xcode에서:

### 3-1. Signing & Capabilities
1. 좌측 프로젝트 트리 → **App** 선택
2. **Signing & Capabilities** 탭
3. **Team**: Apple Developer 계정 선택 (U73UP8WL5G)
4. **Bundle Identifier**: `app.tenol.club` 확인
5. **Automatically manage signing** 체크

### 3-2. Sign in with Apple Capability 추가
1. **Signing & Capabilities** 탭에서
2. **+ Capability** 클릭
3. **Sign in with Apple** 검색 → 추가

### 3-3. 배포 타겟 확인
1. **General** 탭
2. **Minimum Deployments**: iOS 15.0 이상
3. **Display Name**: 테놀
4. **Version**: 1.2 (project.pbxproj에 이미 설정됨)
5. **Build**: 4 (project.pbxproj에 이미 설정됨, 이전 제출 Build 3보다 높음)

### 3-4. ⚠️ Apple 심사 4번 거절 수정 사항 (1.2 / Build 4)
이 빌드는 두 가지 거절 사유를 모두 해결합니다:
- **Sign in with Apple 이름 자동 채우기**: Apple이 제공한 이름을 자동 저장하므로 사용자가 이름 입력 화면을 보지 않음 (트리거 + 로그인 페이지 + 온보딩 페이지 모두 수정)
- **카메라 크래시 해결**: `Info.plist`에 `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription` 추가됨
- **UGC 신고/차단 기능**: 모집글 더보기 메뉴에 신고/차단 추가 (Guideline 1.2 사전 대응)

### 3-5. DB 마이그레이션 (Supabase)
Mac에서 빌드하기 전에 반드시 Supabase 마이그레이션을 실행:
```bash
# Supabase 대시보드 → SQL Editor → 두 파일 실행
# supabase/migrations/00037_oauth_metadata_in_profile.sql
# supabase/migrations/00038_user_reports_and_blocks.sql
```

---

## STEP 4: 빌드 & Archive

1. 상단 타겟 선택: **Any iOS Device (arm64)** (시뮬레이터 X)
2. 메뉴 → **Product** → **Archive**
3. 빌드 완료 시 **Organizer** 창 자동 열림 (약 3-10분 소요)

### 빌드 에러 발생 시
- **Signing 에러**: Xcode → Settings → Accounts에서 Apple ID 로그인 확인
- **CocoaPods 에러**: `cd ios/App && pod install` 실행
- **Swift Package 에러**: Xcode → File → Packages → Resolve Package Versions

---

## STEP 5: App Store Connect에 업로드

Organizer에서:
1. 방금 Archive된 빌드 선택
2. **Distribute App** 클릭
3. **App Store Connect** → **Upload** 선택
4. 모든 옵션 기본값 유지 → **Upload**
5. 업로드 완료 메시지 확인

업로드 후 App Store Connect에서 빌드 처리까지 **10-30분** 소요.

---

## STEP 6: App Store Connect에서 재제출

### https://appstoreconnect.apple.com 접속

1. **나의 앱** → **테놀** 선택
2. 기존 거절된 버전에서 **새 빌드 선택** (방금 업로드한 빌드)
3. 아래 정보 확인/수정:

#### 스크린샷
- Apple 심사에서 아이콘이 placeholder라고 했으므로, 새 아이콘이 반영된 스크린샷도 업데이트
- iPhone 6.7" (1290 × 2796) 최소 3장

#### 앱 설명
```
테놀은 테니스 클럽 운영을 위한 올인원 앱입니다.

주요 기능:
• 클럽 생성 및 멤버 관리
• 경기 생성, 참가자 관리, 대기열
• 자동 대진표 생성 (혼복/남복/여복/자유)
• 실시간 점수 입력 및 결과 기록
• 개인/클럽 통계 및 랭킹
• 반복 경기 템플릿
• 게스트 모집 게시판
• 경기 결과 이미지 공유

테니스 동호회, 사내 클럽, 레슨 그룹 등 함께 테니스를 즐기는 모든 모임에서 사용하세요.
```

#### 심사 메모 (Review Notes)
```
이 앱은 테니스 클럽 운영을 위한 관리 앱입니다.
로그인: Apple, Google, Kakao 세 가지 소셜 로그인을 지원합니다.
Sign in with Apple이 첫 번째 옵션으로 제공됩니다.

테스트 방법:
1. Apple로 시작하기 버튼으로 로그인
2. 온보딩 완료 (닉네임, 성별 입력)
3. 클럽 만들기 → 경기 생성 → 대진표 생성 → 점수 입력

네이티브 기능: 푸시 알림, 햅틱 피드백, 네이티브 공유, 키보드 최적화, 상태바 제어
```

#### 수출 규정
- **암호화 사용**: 아니요 (표준 HTTPS만 사용)

4. **심사에 제출** 클릭

---

## 주의사항

- Archive 전에 반드시 **Any iOS Device (arm64)** 선택 (시뮬레이터로 하면 Archive 불가)
- 이전 빌드보다 **Build 번호**를 높여야 함
- `.p8` 키 파일은 git에 포함되지 않음 (`.gitignore`에 등록됨)
- Capacitor 플러그인 7개가 설치되어 있어 "단순 WebView 래퍼" 거절 위험 낮음

---

## 문제 발생 시

### "No signing certificate" 에러
→ Xcode → Settings → Accounts → Apple ID → Download Manual Profiles

### "Provisioning profile" 에러  
→ Automatically manage signing 체크 해제 후 다시 체크

### Archive가 회색으로 비활성화
→ 상단 빌드 타겟이 시뮬레이터가 아닌 "Any iOS Device"인지 확인

### 업로드 후 "Processing" 오래 걸림
→ 정상. 최대 30분 소요. App Store Connect에서 상태 확인 가능.
