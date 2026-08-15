# 🍎 테놀 iOS 빌드 — Mac 작업자용 가이드 (2026-08-15)

> 이 문서 하나만 따라 하면 됩니다. 다른 문서(IOS_BUILD_GUIDE.md 등)는 낡았으니 무시하세요.
> 예상 소요: 30~40분 (Xcode 다운로드 제외)

## 준비물

- Mac + **Xcode 15 이상** (App Store에서 설치)
- **Node.js 20 이상** — 없으면 https://nodejs.org 에서 LTS 설치
- **앱 소유자의 Apple Developer 계정** 로그인 필요 (Team: `U73UP8WL5G`)
  - Xcode → Settings → Accounts에서 로그인. 2단계 인증 코드는 소유자에게 실시간으로 받아야 함
- CocoaPods는 **필요 없음** (이 프로젝트는 SPM 사용 — `pod install` 하지 마세요)

## 1. 터미널에서 (순서·명령 정확히)

```bash
git clone https://github.com/bh-agent/Tenol.git
cd Tenol
npm install          # ⚠️ 건너뛰면 안 됨 — Apple 로그인 플러그인 패치가 자동 적용됨
npm run cap:sync     # ⚠️ 'npx cap sync'가 아니라 반드시 이 명령 (오프라인 페이지를 앱에 포함시킴)
npx cap open ios     # Xcode가 열림
```

## 2. Xcode에서

1. 왼쪽 파일 트리 최상단 **App** 클릭 → TARGETS **App** 선택 → **Signing & Capabilities** 탭
2. **Team**: 소유자 계정의 팀 선택, "Automatically manage signing" 체크
3. **+ Capability** 버튼으로 아래 3개 추가 (이미 있으면 통과):
   - `Sign in with Apple`
   - `Push Notifications`
   - `Background Modes` → 목록에서 **Remote notifications** 체크
4. **General** 탭에서 Version **1.2.1**, Build **7** 확인
   - 업로드 시 "이미 존재하는 빌드 번호" 오류가 나면 Build를 8로 올리고 다시 Archive

## 3. 실기기 테스트 (제출 전 필수)

아이폰을 USB로 연결하고 상단 기기 선택 → ▶ 실행. 아래를 확인:

- [ ] **Apple로 시작하기** → 로그인 성공 → 클럽 화면 진입 (가장 중요 — 이전 심사 거절 사유)
- [ ] **카카오/구글로 시작하기** → 브라우저 열림 → 동의 → *"테놀에서 열기"* 확인 → 브라우저 닫히고 앱 복귀
- [ ] 프로필 → 설정 → **계정 삭제**가 성공하는지 (테스트 계정으로)
- [ ] 비행기 모드 → 앱 실행 → 오프라인 화면 → 네트워크 켜고 "다시 시도" → 정상 복귀
- [ ] 두 손가락 **핀치 줌** 동작
- [ ] 다른 사람 프로필/클럽의 ⋯ 메뉴에서 **신고·차단** 동작

## 4. 아카이브 → 업로드

1. 상단 기기 선택을 **Any iOS Device (arm64)** 로 변경
2. 메뉴 **Product → Archive** (몇 분 소요)
3. Organizer 창 → **Distribute App** → **App Store Connect** → **Upload** → 기본값으로 진행
4. 업로드 완료를 소유자에게 알리기 — 이후 심사 제출은 소유자가 App Store Connect에서 진행

## 문제 발생 시

| 증상 | 해결 |
|---|---|
| `npm install` 오류 | Node 버전 확인 (`node -v` ≥ 20) |
| 서명 오류 (provisioning) | Team 재선택 → Xcode → Settings → Accounts → Download Manual Profiles |
| 카카오/구글 로그인 후 복귀 안 됨 | 소유자에게 "Supabase Redirect URLs 확인" 요청 |
| 빌드 번호 충돌 | General 탭에서 Build를 8, 9로 올리고 재-Archive |
