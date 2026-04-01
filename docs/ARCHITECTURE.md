# 아키텍처 문서

> 최종 업데이트: 2026-04-01

---

## 1. 시스템 구조

```
┌─────────────────────────────────────────────────┐
│                    Vercel                        │
│  ┌───────────────────────────────────────────┐   │
│  │           Next.js 16 (Turbopack)          │   │
│  │  ┌─────────┐  ┌──────────┐  ┌─────────┐  │   │
│  │  │  Pages   │  │  Server  │  │   API   │  │   │
│  │  │  (RSC)   │  │ Actions  │  │ Routes  │  │   │
│  │  └────┬─────┘  └────┬─────┘  └────┬────┘  │   │
│  │       │             │             │        │   │
│  │  ┌────▼─────────────▼─────────────▼────┐   │   │
│  │  │         Middleware (Auth Guard)      │   │   │
│  │  └────────────────┬────────────────────┘   │   │
│  └───────────────────┼───────────────────────┘   │
└──────────────────────┼───────────────────────────┘
                       │
            ┌──────────▼──────────┐
            │      Supabase       │
            │  ┌───────────────┐  │
            │  │  PostgreSQL   │  │  ← RLS 정책
            │  │  + RPC 함수   │  │
            │  ├───────────────┤  │
            │  │     Auth      │  │  ← 카카오/Google OAuth
            │  ├───────────────┤  │
            │  │   Storage     │  │  ← 이미지/동영상
            │  └───────────────┘  │
            └─────────────────────┘
```

## 2. 데이터 흐름

### 읽기 (서버 컴포넌트)

```
Page (RSC) → lib/queries/*.ts → Supabase Client (server) → PostgreSQL
                                                              ↓ RLS 필터
                                                           결과 반환
```

### 쓰기 (서버 액션)

```
Client Component → "use server" action → Zod 검증 → 권한 확인 → DB 쿼리
                                                                    ↓
                                                          revalidatePath()
                                                                    ↓
                                                           클라이언트 갱신
```

### 대진표 생성

```
Client → POST /api/draw/generate → 참가자 조회
                                      ↓
                                  Draw Engine (순수 함수)
                                  ├─ 모드 결정 (mixed_all/mixed_only/gendered_only/free)
                                  ├─ 성별 분류
                                  ├─ NTRP 정렬
                                  ├─ 서펜타인 페어링
                                  ├─ 타임슬롯/코트 배정
                                  └─ 검증 (중복, 성별, 게임 수 균형)
                                      ↓
                                  draws + games 테이블 INSERT
```

## 3. 인증 흐름

```
로그인 페이지 → 카카오/Google OAuth → Supabase Auth
      ↓
  auth/callback → 세션 설정
      ↓
  Middleware 확인:
  ├─ 세션 없음 → /login 리다이렉트
  ├─ 온보딩 미완료 → /onboarding 리다이렉트
  └─ 정상 → 요청 통과
```

## 4. 권한 모델

```
역할 계층: owner > admin > member > (비멤버)

owner:  match.create, match.edit, match.delete,
        draw.manage, member.manage, settings.edit
admin:  match.create, match.edit, draw.manage, member.manage
member: match.create
비멤버: (읽기만 가능, RLS로 제한)
```

- 서버 액션에서 `requirePermission(clubId, permission)` 호출
- DB 레벨에서 RLS 정책으로 이중 보호

## 5. DB 스키마

### 핵심 테이블 관계

```
profiles ──1:N──▶ club_members ◀──N:1── clubs
    │                  │
    │              (role: owner/admin/member)
    │
    ├──1:N──▶ matches ──1:N──▶ match_participants
    │              │
    │              └──1:N──▶ draws ──1:N──▶ games
    │
    ├──1:N──▶ media ──1:N──▶ media_likes
    │              ├──1:N──▶ media_comments
    │              ├──1:N──▶ media_tags
    │              └──1:N──▶ media_mentions
    │
    ├──1:N──▶ follows (follower_id, following_id)
    ├──1:N──▶ notifications
    └──1:N──▶ club_bookmarks
```

### 주요 테이블

| 테이블 | 설명 | 주요 컬럼 |
|--------|------|-----------|
| `profiles` | 사용자 | display_name, ntrp_level, gender, is_onboarded |
| `clubs` | 클럽 | name, invite_code, is_public, region |
| `club_members` | 멤버십 | club_id, user_id, role |
| `matches` | 경기 | club_id, match_date, court_count, status |
| `match_participants` | 참가자 | match_id, user_id, participant_type, status |
| `draws` | 대진표 | match_id, round_number, draw_type |
| `games` | 게임 | draw_id, court_number, team_a/b_player1/2_id, score |
| `media` | 게시물 | club_id, file_urls, caption, feed_type |
| `notifications` | 알림 | user_id, type (14종), data (JSONB) |
| `recruitment_posts` | 모집글 | club_id, male/female/any_slots, ntrp_min/max |

### RPC 함수

- `join_match_atomically(match_id, user_id)` — 동시 참가 방지 (원자적 체크+삽입)
- `is_club_admin(club_id)` — RLS 정책용 관리자 확인
- `handle_new_user()` — 회원가입 시 프로필 자동 생성 트리거

## 6. 프론트엔드 아키텍처

### 컴포넌트 계층

```
RootLayout (인증 체크, 메타데이터)
└── MainLayout (BottomNav, ScrollTopButton)
    └── Page (서버 컴포넌트)
        ├── TopBar (뒤로가기, 제목, 액션)
        └── Client Components
            ├── UI 컴포넌트 (Button, Card, Modal, Toast...)
            └── 도메인 컴포넌트 (ClubTabs, MatchActions, FeedList...)
```

### 상태 관리

- **서버 상태**: React Server Components (RSC) — DB에서 직접 조회
- **클라이언트 상태**: useState/useReducer — 폼, UI 토글
- **낙관적 업데이트**: 좋아요, 팔로우 등 즉각 반응
- **캐시 무효화**: `revalidatePath()` — 서버 액션 후 자동 갱신

### 디자인 시스템

- **테마**: 다크 모드 전용 (#0A0A0A 배경, #00E676 포인트)
- **폰트**: Pretendard Variable
- **레이아웃**: 모바일 퍼스트 (max-w-lg 중앙 정렬)
- **효과**: Glass morphism, Glow, Shimmer skeleton
- 상세 → [DESIGN.md](../DESIGN.md)

## 7. API 라우트

| 엔드포인트 | 메서드 | 용도 |
|-----------|--------|------|
| `/api/draw/generate` | POST | 대진표 생성 (Draw Engine 호출) |
| `/api/draw/release-lock` | POST | 대진표 편집 잠금 해제 |
| `/api/clubs/[clubId]/h2h` | GET | 상대 전적 조회 |
| `/api/feed/discover` | GET | 디스커버리 피드 (알고리즘) |
| `/api/feed/more` | GET | 피드 페이지네이션 |
| `/api/mentions` | GET | @멘션 자동완성 |

## 8. 보안

- **인증**: Supabase Auth + Middleware 가드
- **인가**: 서버 액션 `requirePermission()` + DB RLS 이중 체크
- **입력 검증**: Zod 스키마로 모든 사용자 입력 검증
- **동시성**: `join_match_atomically` RPC + 대진표 편집 잠금
- **환경 변수**: `.env.local` (Git 미추적)

## 9. 프로젝트 통계 (2026-04-01 기준)

| 항목 | 수치 |
|------|------|
| 전체 코드 | ~26,900줄 (TS/TSX) |
| 페이지 라우트 | 25개 |
| API 라우트 | 7개 |
| React 컴포넌트 | 87개 |
| 서버 액션 | 56개 |
| DB 쿼리 함수 | 60+개 |
| DB 마이그레이션 | 28개 |
| DB 테이블 | 15개 (뷰 포함) |
| npm 의존성 | 13개 (prod) + 5개 (dev) |
