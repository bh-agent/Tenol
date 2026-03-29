# 테놀 (Tenol) 종합 앱 리뷰 리포트

> 작성일: 2026-03-29
> 검토 관점: UX/UI, 코드 품질, 테니스 도메인, 제품 전략, SNS/소셜

---

## 1. 종합 평가

| 항목 | 점수 | 비고 |
|------|------|------|
| 기능 완성도 | 7.5/10 | 핵심 루프 완성, 푸시/채팅/반복경기 미구현 |
| 유저 여정 | 7/10 | 콜드 스타트 문제, 가이드 부재 |
| 디자인 품질 | 8.5/10 | 전문적, 일관적, 모바일 최적화 |
| 성장 메커니즘 | 5/10 | 관리자 중심 초대, 바이럴 루프 부재 |
| 리텐션 | 5.5/10 | 경기 당일 강함, 비경기일 약함 |
| 기술 기반 | 7/10 | PWA+Supabase MVP 단계 적합 |
| 경쟁 우위 | 7/10 | 대진표 엔진이 킬러 피처 |
| **총점** | **6.8/10** | |

---

## 2. 이번 리뷰에서 수정한 버그 (14개 파일, 20+ 수정)

### 코드 품질 버그 (6건)
| 파일 | 문제 | 수정 |
|------|------|------|
| `lib/queries/clubs.ts` | `getMyRole()` .single() 비멤버 시 크래시 | .maybeSingle() |
| `lib/utils/check-permission.ts` | requirePermission .single() 비멤버 시 크래시 | .maybeSingle() x2 |
| `lib/supabase/middleware.ts` | .single() 신규유저 크래시 + 중복 쿼리 | .maybeSingle() + 쿼리 통합 |
| `auth/callback/route.ts` | .single() 프로필 미생성 시 크래시 | .maybeSingle() |
| `lib/queries/matches.ts` | getMyGamesInMatch .single() 비참가자 크래시 | .maybeSingle() |
| `lib/actions/recruitment.ts` | `\|\|` 연산자가 0을 null로 변환 | `??` nullish coalescing |

### UX/UI 버그 (3건)
| 파일 | 문제 | 수정 |
|------|------|------|
| `layout/top-bar.tsx` | 뒤로가기 터치 영역 32px (최소 44px 필요) | p-2.5 + aria-label |
| `layout/bottom-nav.tsx` | 활성 인디케이터 위치 오류 (relative 누락) | Link에 relative 추가 |
| `media/like-button.tsx` | 빠른 탭 시 좋아요 수 오염 (stale closure) | prevCount 캡처 |

### 소셜 기능 (4건)
| 파일 | 문제 | 수정 |
|------|------|------|
| `lib/actions/social.ts` | 좋아요/댓글 알림 미발송 | new_like, new_comment 알림 추가 |
| `notifications/notification-item.tsx` | 좋아요/댓글 알림 아이콘 누락 | Heart, MessageCircle 추가 |
| `media/caption-text.tsx` | 해시태그 클릭 불가인데 cursor-pointer | cursor 제거 |
| `media/comment-sheet.tsx` | 댓글에서 @멘션 스타일링 안됨 | CaptionText 렌더링 추가 |

---

## 3. UX/UI 리뷰 결과

### Critical (즉시 수정 필요) - 5건
1. **뒤로가기 터치 영역 32px** → **수정 완료**
2. **하단 탭 활성 인디케이터 위치 오류** → **수정 완료**
3. **결과 입력 +/- 버튼 36x28px** → 44x44px으로 확대 필요
4. **캐러셀 점 인디케이터 6px** → 터치 패딩 추가 필요
5. **로그인 이용약관 링크 비활성** → 실제 URL 연결 필요 (법적 이슈)

### High (조기 수정 권장) - 7건
- 로그인 페이지 `<img>` → Next.js `<Image>` 전환
- 대진표 참가자 칩 버튼 18px → 44px
- 피드/클럽 페이지 loading.tsx 추가 필요
- `alert()`/`confirm()` → Toast/Modal 전환 (PWA 깨짐)
- 에러 바운더리 추가
- 드롭다운 메뉴 aria 속성 추가
- 설정 페이지 로드 실패 시 빈 폼 저장 방지

### Medium/Low - 16건
- FAB safe-area 계산, 모달 포커스 트랩, 10px 폰트 크기 등

---

## 4. 테니스 도메인 리뷰

### 잘 구현된 부분
- **대진표 엔진**: 4개 모드 (혼복+남복+여복, 혼복만, 성별별, 자유) 모두 정확
- **NTRP 균형 매칭**: 서펜타인 페어링 (High-M+Low-F vs Low-M+High-F) 정석
- **동시 코트 충돌 방지**: usedThisSlot Set으로 이중 배정 방지
- **한국 테니스 용어**: 대진표, 복식, 혼복, 구력, 코트 등 정확 사용
- **클럽 역할 체계**: 클럽장/운영진/멤버 한국 동호회 구조 적합

### 개선 필요 (must-fix 2건)
1. **점수 시스템이 테니스 스코어링이 아님**: 단순 정수 점수만 지원. `set_scores` 필드가 DB에 존재하지만 미사용. 최소한 "득점" 라벨 추가 또는 세트 기반 스코어링 구현 필요
2. **set_scores 기반 업적 미작동**: 역전승 감지 업적이 set_scores를 참조하지만 데이터가 없어 영원히 트리거되지 않음

### 개선 권장 (nice-to-have 7건)
- 성별 fallback 시 사용자에게 경고 표시
- 대진표 검증 경고를 UI에 표시
- 매치 상태 전환 검증 (completed → upcoming 방지)
- MVP 계산을 승률 기반으로 변경
- 게스트 모집에 게임 포맷 선택지 추가
- "혼합 복식" → "혼복" 용어 통일

---

## 5. 제품 전략 리뷰

### 핵심 가치 제안
> "클럽 운영진의 매주 30분간의 수동 대진표 작성, 출석 관리, 점수 기록을 원탭 자동화로 대체 — 모든 회원에게 통계, 업적, 소셜 피드 제공"

### 경쟁 우위 vs 카카오톡

| 기능 | 카카오톡 | 테놀 |
|------|---------|------|
| 경기 일정 | 수동 메시지/투표 | 구조화된 일정 관리 |
| 대진표 생성 | 수동 (엑셀/종이) | **4개 모드 자동 생성** |
| 점수 기록 | 비영구적 | 영구 기록 |
| 통계 | 없음 | 풀 대시보드 |
| 멤버 관리 | 채팅방 관리자만 | 세분화된 RBAC |

### P0 - PMF 달성에 필수 (2주 내)
1. **웹 푸시 알림**: 경기 리마인더, 대진표 발표, 점수 업데이트 알림. 없으면 카카오톡에 진다
2. **이용약관/개인정보 처리방침 페이지**: 법적 필수 (한국 PIPA)
3. **일반 멤버도 초대 링크 공유 가능**: 현재 관리자만 가능

### P1 - 리텐션 강화 (2개월 내)
4. **반복 경기 템플릿**: 매주 같은 시간/장소 경기 자동 생성
5. **세트 기반 점수 입력**: 테니스 스코어링 반영
6. **공유 가능한 스탯 카드**: "내 전적" 이미지 생성 → SNS 공유
7. **경기별 채팅/댓글 스레드**: 카카오톡 의존 감소
8. **대기자 명단**: 마감 시 자동 대기열

### P2 - 성장 (6개월 내)
9. 코트비 관리/정산
10. 앱스토어/플레이스토어 네이티브 래퍼
11. 지역 간 리더보드
12. 토너먼트 모드
13. 프리미엄 티어 (대형 클럽용)

---

## 6. SNS/소셜 기능 리뷰

### 현재 상태
| 기능 | 점수 | 비고 |
|------|------|------|
| 피드 시스템 | 8/10 | 3단계 알고리즘, 무한 스크롤 |
| 게시물 작성/수정 | 8/10 | 멀티 이미지, 멘션, 해시태그 |
| 좋아요/댓글 | 8/10 | 더블탭, 옵티미스틱 업데이트 (버그 수정 완료) |
| 프로필/소셜 그래프 | 8.5/10 | 팔로우, 추천, 그리드/리스트 |
| 알림 | 7.5/10 | 좋아요/댓글 알림 추가 완료, 푸시 미구현 |
| 콘텐츠 디스커버리 | 4/10 | 검색 페이지 없음 (가장 큰 갭) |

### 누락된 주요 기능 (우선순위)
1. **P0 - 유저 검색 페이지** (`/search`): 이름/NTRP/지역 필터
2. **P1 - 해시태그 검색**: `#태그` 클릭 → 관련 게시물 표시
3. **P2 - 탐색 그리드**: 인스타 스타일 인기 게시물 그리드
4. **P3 - 최근 검색 기록**

---

## 7. 리스크 평가

### 높은 리스크
1. **카카오톡 의존 역설**: 초대 링크 공유에 카카오톡이 필요하면서, 카카오톡과 커뮤니케이션 레이어에서 경쟁
2. **관리자 이탈 리스크**: 관리자 1명 이탈 시 클럽 전체 사용 중단 가능
3. **푸시 알림 부재**: 앱이 비경기일에 "죽은" 느낌

### 중간 리스크
4. 수익화 모델 미정립
5. 콘텐츠 모더레이션 도구 부재
6. 데이터 내보내기 기능 없음

---

## 8. 기술 아키텍처 요약

```
프론트엔드: Next.js 16 (Turbopack) + Tailwind CSS
백엔드: Supabase (PostgreSQL + Auth + Storage + RLS)
배포: Vercel (프로덕션)
인증: 카카오 OAuth + Google OAuth
PWA: manifest.json + 아이콘 + standalone 모드
상태: 서버 컴포넌트 + 클라이언트 옵티미스틱 업데이트
```

### 파일 구조
```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # 로그인, 콜백
│   ├── (main)/            # 인증 필요 라우트
│   │   ├── clubs/         # 클럽 (CRUD, 멤버, 경기, 대진표, 결과, 설정, 모집, 관리)
│   │   ├── feed/          # 소셜 피드
│   │   ├── my-matches/    # 내 경기
│   │   ├── notifications/ # 알림
│   │   ├── profile/       # 프로필
│   │   ├── recruit/       # 모집 탐색
│   │   └── onboarding/    # 온보딩
│   └── api/               # API 라우트 (대진표 생성, 피드, 멘션)
├── components/            # UI 컴포넌트
│   ├── club/              # 클럽 관련
│   ├── feed/              # 피드 관련
│   ├── layout/            # 레이아웃 (TopBar, BottomNav)
│   ├── match/             # 경기 관련
│   ├── media/             # 미디어 (PostCard, Upload, Like, Comment)
│   ├── notifications/     # 알림
│   ├── profile/           # 프로필
│   ├── recruitment/       # 모집
│   ├── pwa/               # PWA (설치 프롬프트, SW 등록)
│   └── ui/                # 공통 UI (Button, Card, Modal, Badge, Toast 등)
├── lib/
│   ├── actions/           # 서버 액션 (clubs, matches, media, social, profile, recruitment)
│   ├── queries/           # DB 쿼리 (clubs, matches, media, feed, notifications, achievements)
│   ├── draw-engine/       # 대진표 생성 엔진
│   ├── hooks/             # 커스텀 훅 (useMentionInput)
│   ├── supabase/          # Supabase 클라이언트/서버/미들웨어
│   ├── utils/             # 유틸리티 (permissions, format, cn, mentions)
│   └── validations/       # Zod 스키마
├── types/                 # TypeScript 타입 정의
└── supabase/migrations/   # DB 마이그레이션 (00001~00021)
```

### 주요 DB 테이블
```
profiles          - 사용자 프로필 (NTRP, 성별, 실명 등)
clubs             - 클럽 (이름, 설명, 초대코드)
club_members      - 멤버십 (role: owner/admin/member)
club_join_requests - 가입 신청 (introduction 포함)
matches           - 경기 (날짜, 포맷, 코트 수)
match_participants - 참가자 (상태, 게스트/멤버, introduction)
draws             - 대진표
games             - 개별 게임 (점수, 팀 구성)
media             - 게시물 (사진/동영상)
media_likes       - 좋아요
media_comments    - 댓글
media_tags        - 해시태그
media_mentions    - 멘션
notifications     - 알림
follows           - 팔로우 관계
recruitment_posts - 모집글 (성별 슬롯)
```

---

## 9. 적용된 마이그레이션 목록

| 번호 | 파일 | 내용 |
|------|------|------|
| 00001 | initial_schema | 핵심 테이블 (clubs, members, matches, participants, draws, games) |
| 00007 | allow_null_userid | 비회원 참가자 허용 |
| 00008 | add_guest_gender | 게스트 성별 |
| 00009 | notifications | 알림 시스템 |
| 00010 | atomic_join_match | 원자적 경기 참가 RPC |
| 00011 | social_features | 좋아요, 댓글, 미디어 |
| 00012 | follow_system | 팔로우 |
| 00013 | club_bookmarks | 클럽 북마크 |
| 00014 | tags_mentions | 해시태그, 멘션 |
| 00015 | club_join_requests | 클럽 가입 신청 |
| 00016 | recruitment_posts | 모집글 |
| 00017 | add_draw_type_values | 대진표 타입 확장 |
| 00018 | admin_add_member_policy | 관리자 멤버 추가 RLS |
| 00019 | recruitment_gender_slots | 모집 성별 슬롯 |
| 00020 | join_application_fields | 신청 자기소개 |
| 00021 | profile_real_name | 프로필 실명 |

---

## 10. 다음 단계 권장 사항

### 즉시 (이번 주)
- [ ] 이용약관/개인정보 처리방침 페이지 생성 및 링크 연결
- [ ] 결과 입력 버튼 터치 영역 확대 (44px)
- [ ] alert()/confirm() → Toast/Modal 전환
- [ ] loading.tsx 추가 (feed, clubs/[clubId])

### 단기 (2주 내)
- [ ] 웹 푸시 알림 (Service Worker)
- [ ] 유저 검색 페이지 (/search)
- [ ] 일반 멤버 초대 링크 공유 허용
- [ ] 카카오 비즈앱 전환 → 이메일 동의항목 활성화

### 중기 (1~2개월)
- [ ] 반복 경기 템플릿
- [ ] 세트 기반 점수 입력
- [ ] 공유 가능한 스탯 카드
- [ ] 경기별 채팅
- [ ] 대기자 명단

---

*이 리포트는 UX/UI, 코드 품질, 테니스 도메인, 제품 전략, SNS 총 5개 전문 관점에서 앱 전체를 점검한 결과입니다.*
