# 라이트모드 도입 계획

작성일: 2026-10-16
상태: 구현 완료 (2026-10-16). 최종 색값은 DESIGN.md Themes 절이 기준. 초안의 몇몇 값은 바닥색(#F5F6F5) 기준 4.5:1을 못 넘겨 한 단계 더 진하게 조정함.

## 0. 한 줄 결론

가능하다. 앱이 이미 Tailwind v4 `@theme` 토큰 기반이라 UI의 약 90%는 토큰 20여 개를 라이트 값으로 재정의하면 자동으로 바뀐다. 남는 작업은 (1) 하드코딩 색 치환 약 30개 파일, (2) 브랜드 그린의 명도 대비 재설계, (3) 네이티브 상태바·메타 색 연동, (4) 전 화면 QA다. 혼자 작업 기준 2.5~3일.

디자이너 별도 고용은 필요 없다. 팔레트·대비·컴포넌트 결정은 이 문서에서 디자이너 관점으로 확정하고, 구현 후 `/design-review`로 시각 QA를 돌린다.

---

## 1. 현재 구조 진단

| 항목 | 현황 | 라이트모드 영향 |
|---|---|---|
| 색 토큰 | `src/app/globals.css` `@theme inline` 에 20개 | 재정의만으로 전환 가능 |
| 토큰 사용 | `text-muted-foreground` 478, `text-foreground` 337, `border-border` 205, `text-primary` 200, `bg-surface` 179, `bg-primary` 117 | 자동 전환 |
| 하드코딩 white/black 유틸 | 56곳 / 30파일 (`text-black` 20, `bg-black/60` 류 오버레이 16, `border-white/[0.06]` 6, `bg-white/5` 2 등) | 일부 치환 필요 |
| 하드코딩 hex (tsx) | 232곳. 이 중 공유 이미지 3개 파일 86곳, 로그인 소셜 버튼 8곳은 **의도적으로 유지** | 실제 치환 대상 약 60곳 |
| 그린 글로우 `rgba(0,230,118,…)` | 33곳 | 라이트에서 거의 안 보임, 해롭지 않음. 그대로 둬도 됨 |
| 검은 그림자 `rgba(0,0,0,…)` | 6곳 | 라이트에서 농도만 낮추면 됨 |
| 테마 전환 인프라 | 없음 (`dark:` 변형, `prefers-color-scheme`, `data-theme` 전무) | 신규 구축 |
| 네이티브 | 상태바 `Style.Dark` + `#0A0A0A` 고정, 스플래시 `#0A0A0A`, viewport themeColor `#0A0A0A` | 상태바·themeColor 동적화. 스플래시는 다크 유지 |
| `<select>` | `colorScheme: 'dark'` 인라인 고정 | 테마 CSS의 `color-scheme`로 대체 |
| OAuth 중간 페이지 (route.ts 2개) | `#0A0A0A` 배경 하드코딩 | 쿠키 읽어 분기 (선택) |

---

## 2. 디자인 결정 (디자이너 관점)

### 2-1. 핵심 문제: 브랜드 그린은 흰 배경에서 글자로 못 쓴다

`#00E676`을 흰 배경에 글자로 쓰면 명도 대비 1.6:1로 WCAG AA(4.5:1)에 한참 못 미친다. 버튼 배경(검은 글자)으로는 13:1이라 문제없다. 즉 **"채움용 그린"과 "글자용 그린"을 분리**해야 한다.

| 토큰 | 다크 | 라이트 | 라이트 대비(흰 배경) |
|---|---|---|---|
| `--color-primary` (채움: 버튼, FAB, 인디케이터) | `#00E676` | `#00C853` | 검은 글자 9.4:1 |
| `--color-primary-ink` (글자·아이콘·링크) **신규** | `#00E676` | `#007F55` | 5.1:1 (AA 통과, 바닥 기준 4.6:1) |
| `--color-primary-light` (호버) | `#69F0AE` | `#00E676` | 채움 전용 |
| `--color-primary-dark` (눌림) | `#00C853` | `#00A846` | 채움 전용 |
| `--color-primary-dim` (옅은 틴트) | `rgba(0,230,118,.12)` | `rgba(0,200,83,.10)` | - |

적용 방식: 코드 전체에서 `text-primary` → `text-primary-ink` 로 일괄 치환(정규식 `\btext-primary\b`, `text-primary-light` 등은 제외). 다크에서는 두 토큰 값이 같아 **기존 화면은 1픽셀도 안 바뀐다.** 라이트에서만 글자가 진한 그린이 된다.

버튼 위 글자 `text-black`(20곳)은 양쪽 테마 모두 그린 채움 위에 놓이므로 **변경 불필요.**

### 2-2. 라이트 팔레트

"하얀색"이되 카드가 바닥과 구분되도록 바닥은 아주 옅은 회색, 카드는 순백으로 한다.

| 토큰 | 다크 | 라이트 | 비고 |
|---|---|---|---|
| `--color-background` | `#0A0A0A` | `#F5F6F5` | 바닥. 순백 카드가 떠 보이게 |
| `--color-surface` / `--color-card` | `#141414` | `#FFFFFF` | 카드 |
| `--color-surface-elevated` | `#1C1C1C` | `#F0F1F0` | 고스트 호버, 스켈레톤 |
| `--color-surface-hover` | `#222222` | `#E8EAE8` | |
| `--color-foreground` / `--color-card-foreground` | `#F5F5F5` | `#111111` | 본문 글자 |
| `--color-muted` (인풋 배경) | `#1A1A1A` | `#F0F1F0` | |
| `--color-muted-foreground` | `#A3A3A3` | `#5C5F5C` | 6.3:1 |
| `--color-subtle` (플레이스홀더) | `#7A7A7A` | `#8A8D8A` | 3.5:1 (플레이스홀더 허용 범위) |
| `--color-border` | `#2A2A2A` | `#E2E4E2` | |
| `--color-border-light` | `#1F1F1F` | `#ECEEEC` | |
| `--color-hairline` **신규** | `rgba(255,255,255,.06)` | `rgba(0,0,0,.06)` | `border-white/[0.06]`, `divide-white/[0.04]`, `bg-white/5` 대체 |
| `--color-scrim` **신규** | `rgba(0,0,0,.6)` | `rgba(0,0,0,.4)` | 모달 배경 `bg-black/60` 대체 (선택. 검정 유지해도 무방) |

### 2-3. 시맨틱 색도 라이트 값이 필요하다

흰 배경에서 노랑·하늘색·연빨강 글자는 모두 대비 실패다. 특히 MVP·메달·경고 표시가 많다.

| 토큰 | 다크 | 라이트 | 라이트 대비 |
|---|---|---|---|
| `--color-success` | `#00E676` | `#007F55` | 5.1:1 |
| `--color-warning` | `#FFD740` | `#9E5F00` | 5.1:1 |
| `--color-info` | `#40C4FF` | `#1565C0` | 5.8:1 |
| `--color-destructive` | `#FF5252` | `#C62828` | 5.6:1 |
| `--color-medal-gold` **신규** | `#FFD740` | `#8F6400` | 결과·통계 왕관 |
| `--color-medal-silver` **신규** | `#C0C0C0` | `#757575` | |
| `--color-medal-bronze` **신규** | `#CD7F32` | `#A0522D` | |
| `--color-recruit-guest` **신규** | `#42A5F5` | `#1565C0` | 게스트 모집 카드 파랑 |

치환 대상: `text-[#FFD740]`·`text-yellow-400/500`·`text-amber-*`(약 20곳) → `text-warning` 또는 `text-medal-gold`, `#42A5F5`(5곳) → `recruit-guest`, `text-blue-400`·`text-red-400`·`text-emerald-500`(약 10곳) → `info`/`destructive`/`success`. 배경 틴트(`bg-[#FFD740]/15` 등)는 양쪽에서 다 괜찮지만 토큰으로 통일한다.

### 2-4. 효과 클래스

| 클래스 | 라이트 처리 |
|---|---|
| `.glass` | `rgba(255,255,255,.8)` + 동일 blur. 폴백 `rgba(255,255,255,.96)` |
| `.glow-primary`, `.glow-primary-sm` | 유지하되 농도 절반. 흰 배경에선 거의 안 보여 무해 |
| `.text-gradient` | `#007F55 → #00A86B → #007F55` |
| `::selection` | 배경 동일, 글자 `#111` |
| 스크롤바 썸 | 토큰이라 자동 |
| 카드 | 라이트에서 `box-shadow: 0 1px 2px rgba(0,0,0,.04)` 추가 검토 (경계 보강). 1차는 테두리만으로 가고 QA 후 결정 |

### 2-5. 의도적으로 다크 유지

- **공유 이미지 3종** (`draw-share-image.tsx`, `results-share-image.tsx`, `stat-share-card.tsx`): SNS로 나가는 브랜드 자산. 테마와 무관하게 "블랙×그린" 고정. html2canvas 캡처 컨테이너에 `data-theme="dark"`를 박아 토큰 상속도 차단.
- **네이티브 스플래시**: 앱 실행 전이라 테마를 알 수 없음. 다크 유지.
- **로그인 소셜 버튼** (카카오 노랑, 구글 흰색, 애플 검정): 각 플랫폼 가이드라인 색 유지. 단 애플 버튼은 라이트에서 테두리가 흰색이라 보이지 않으므로 `border-white` → `border-border`.
- **매니페스트 `theme_color`**: 설치 시점 값이라 다크 유지. 런타임은 `<meta name="theme-color">`를 JS로 갱신.

### 2-6. 테마 선택 UX

- 설정 위치: 프로필 하단 `SettingsSection` 맨 위에 "화면 테마" 행 추가. 세그먼트 3개: **시스템 / 라이트 / 다크**. 기본값 **시스템**.
- 기존 사용자는 현재 다크를 쓰고 있으므로, 기본값을 시스템으로 두면 폰이 라이트인 사용자는 업데이트 후 갑자기 흰 화면을 본다. 이를 피하려면 **기존 설치 사용자는 '다크' 고정, 신규 사용자만 '시스템'** 으로 한다. 판별: 최초 실행 시 저장된 선호가 없고 `localStorage`에 기존 앱 흔적(예: 서비스워커 등록 플래그)이 있으면 다크로 저장. 과하다고 판단되면 그냥 전원 시스템 기본으로 간다. **결정 필요.**
- 전환 시 `transition: background-color .2s, color .2s`를 `html`에 한 번만 줘서 깜빡임 대신 부드럽게.

---

## 3. 기술 설계

### 3-1. 토큰 2단 구조 (Tailwind v4)

```css
/* globals.css */
:root, [data-theme="dark"] {
  color-scheme: dark;
  --bg: #0A0A0A; --fg: #F5F5F5; --primary: #00E676; --primary-ink: #00E676; …
}
[data-theme="light"] {
  color-scheme: light;
  --bg: #F5F6F5; --fg: #111111; --primary: #00C853; --primary-ink: #007F55; …
}
@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--fg);
  --color-primary: var(--primary);
  --color-primary-ink: var(--primary-ink);
  …
}
@custom-variant light (&:where([data-theme="light"], [data-theme="light"] *));
```

`@theme inline`은 유틸리티에 `var()`를 그대로 박아 넣으므로 런타임 속성 전환이 동작한다. `light:` 변형은 토큰으로 못 푸는 예외(그림자 농도 등)에만 쓴다. 목표는 `light:` 사용 10곳 이하.

`color-scheme`을 테마에 붙이면 `<select>`, 날짜 입력, 스크롤바가 자동으로 따라오므로 `select.tsx`의 인라인 `colorScheme: 'dark'`는 삭제한다.

### 3-2. 저장과 첫 렌더 깜빡임 방지

- 저장소: 쿠키 `tenol-theme` (`system|light|dark`, 1년) + `localStorage` 미러.
- 서버: 루트 레이아웃에서 `cookies()`로 읽어 `<html data-theme>`를 **서버에서** 찍는다. 깜빡임 0. (루트 레이아웃이 동적이 되지만 `(main)`은 이미 Supabase 인증으로 동적이라 실질 비용 없음.)
- `system`일 때만 `<head>` 인라인 스크립트가 `matchMedia('(prefers-color-scheme: dark)')`로 `data-theme`을 확정하고 `change` 이벤트를 구독.
- 클라이언트 훅 `useTheme()` (`src/lib/theme/`): 읽기·쓰기·구독. 쓰기 시 쿠키·localStorage·`data-theme`·네이티브 상태바·`meta[name=theme-color]`를 한 번에 갱신.
- DB 저장은 하지 않는다. 테마는 기기 선호가 표준이고 서버 왕복이 불필요하다.

### 3-3. 네이티브 연동 (`native-init.tsx`)

| 테마 | StatusBar.setStyle | Android setBackgroundColor | meta theme-color |
|---|---|---|---|
| dark | `Style.Dark` | `#0A0A0A` | `#0A0A0A` |
| light | `Style.Light` | `#F5F6F5` | `#F5F6F5` |

`useTheme` 변경 시 즉시 호출. 앱 복귀(`appStateChange` active) 시 재적용. iOS `statusBarStyle: 'black-translucent'`(PWA 메타)는 라이트에서 글자가 안 보이므로 `default`로 바꾸거나 테마별 분기.

### 3-4. 테스트

- `src/lib/theme/__tests__`: 쿠키 파싱, system 해석, 잘못된 값 폴백 (vitest).
- 대비 검사 스크립트: 2장의 표를 코드로 옮겨 각 라이트 글자색 vs 배경 대비가 4.5 이상인지 단위 테스트로 고정. 이후 색 바꿀 때 회귀 방지.

---

## 4. 작업 단계와 순서

| 단계 | 내용 | 산출물 | 예상 |
|---|---|---|---|
| 1. 인프라 | 토큰 2단 구조, `data-theme`, 쿠키/스크립트, `useTheme`, 설정 세그먼트, `primary-ink` 신설 + `text-primary` 일괄 치환 | 라이트 전환 동작, 다크 화면 변화 0 (스크린샷 diff로 확인) | 0.5일 |
| 2. 하드코딩 치환 | 2-1~2-4 표의 토큰 신설 후 grep 목록 기준 치환. 공유 이미지·소셜 버튼 제외 | `grep` 잔존 0 확인 (아래 명령) | 1일 |
| 3. 네이티브·메타 | 상태바, theme-color, `color-scheme`, `select.tsx`, OAuth 중간 페이지 쿠키 분기, `offline.html` 라이트 변형(선택), 애플 버튼 테두리 | 안드로이드 실기기 확인 | 0.5일 |
| 4. QA | `/browse`로 라이트·다크 전 화면 스크린샷 스윕(약 25개 라우트), 대비 자동검사, `/design-review` | 수정 목록 처리 | 0.5~1일 |
| 5. 문서 | `DESIGN.md`에 라이트 열 추가, `offline.html`·스토어 스크린샷 갱신 여부 결정 | | 0.25일 |

잔존 하드코딩 검사 명령 (단계 2 완료 기준, 공유 이미지·로그인 제외 시 0이어야 함):

```sh
grep -rEn "(text|border|divide)-white|bg-white/5|text-\[#(FFD740|42A5F5|C0C0C0|CD7F32)\]|text-(yellow|amber|blue|red|emerald)-[0-9]{3}" src --include=*.tsx \
  | grep -vE "share-image|share-card|login/page"
```

---

## 5. 위험과 대응

| 위험 | 대응 |
|---|---|
| 다크 화면이 미세하게 바뀜 (회귀) | 단계 1 완료 직후 다크 주요 10개 화면 스크린샷을 변경 전과 픽셀 비교. `primary-ink`는 다크 값이 동일해 설계상 변화 없음 |
| 라이트에서 그린 글자가 "브랜드와 다르게" 느껴짐 | `#007F55`는 바닥색 기준 AA 하한 근처 값. 더 밝게 가려면 AA를 포기해야 하므로 **채움은 밝게, 글자는 진하게** 원칙을 유지. 큰 숫자(점수, 통계)는 18px 이상이라 3:1 기준 적용 가능 → `#00A86B` 허용 |
| 안드로이드 WebView에서 `color-scheme` 전환 시 `<select>` 팝업 색 지연 | 실기기 확인. 문제 시 `select.tsx`에 `colorScheme`을 훅 값으로 동적 지정 |
| 업데이트 직후 기존 사용자가 갑자기 흰 화면 | 2-6 결정 사항. 보수적으로 가려면 기존 사용자 다크 고정 |
| 라이트 카드가 바닥과 안 구분됨 | 바닥 `#F5F6F5` vs 카드 `#FFF` 로 1차. QA에서 부족하면 그림자 추가 |
| 스토어 스크린샷·오프라인 페이지가 다크만 | 기능과 무관. 후속 과제로 분리 |

---

## 6. 결정이 필요한 항목

1. 기본값: 전원 **시스템** 따라가기 vs 기존 사용자 **다크 고정**. (권장: 전원 시스템. 단순하고 OS 기대와 일치)
2. 라이트 바닥색: 아주 옅은 회색 `#F5F6F5` (권장) vs 순백 `#FFFFFF`.
3. 모달 배경 스크림: 라이트에서 `rgba(0,0,0,.4)`로 옅게 (권장) vs 현재 `.6` 유지.
4. 공유 이미지 다크 고정에 동의하는지.

위 4개는 기본 권장안으로 진행하고, 다른 의견이 있으면 단계 1 전에 알려주면 된다.
