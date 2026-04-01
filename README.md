# 테놀 (Tenol) — 테니스 치며 놀자

테니스 클럽 운영을 자동화하는 모바일 웹 앱. 대진표 자동 생성, 경기 관리, 통계, 소셜 피드를 하나의 앱에서.

## 핵심 기능

- **대진표 자동 생성** — 4개 모드 (혼복+남복+여복, 혼복만, 성별별, 자유), NTRP 균형 매칭
- **클럽 운영** — 멤버 관리, 역할(클럽장/운영진/멤버), 초대 코드, 가입 신청
- **경기 관리** — 일정 생성, 참가 신청, 게스트 모집, 실시간 점수 입력
- **통계/업적** — 승률, MVP, 연승, 상대 전적, 리더보드
- **소셜 피드** — 사진/동영상 게시, 좋아요, 댓글, 팔로우, @멘션
- **PWA** — 홈 화면 설치, 오프라인 지원

## 기술 스택

| 영역 | 기술 |
|------|------|
| 프론트엔드 | Next.js 16 + React 19 + TypeScript 5 |
| 스타일링 | Tailwind CSS 4 + Pretendard Variable |
| 백엔드/DB | Supabase (PostgreSQL + Auth + Storage + RLS) |
| 인증 | 카카오 OAuth + Google OAuth |
| 배포 | Vercel |
| 아이콘 | Lucide React |
| 검증 | Zod 4 |

## 시작하기

```bash
# 의존성 설치
npm install

# 환경 변수 설정
cp .env.example .env.local
# .env.local에 Supabase URL/Key 입력

# 개발 서버
npm run dev
```

http://localhost:3000 에서 확인

## 프로젝트 구조

```
src/
├── app/                    # Next.js App Router (25 페이지 + 7 API)
│   ├── (auth)/            # 로그인, OAuth 콜백, 온보딩
│   ├── (main)/            # 인증 필요 라우트
│   │   ├── clubs/         # 클럽 CRUD, 멤버, 경기, 대진표, 결과
│   │   ├── feed/          # 소셜 피드
│   │   ├── my-matches/    # 내 경기
│   │   ├── notifications/ # 알림
│   │   ├── profile/       # 프로필
│   │   └── recruit/       # 모집 탐색
│   └── api/               # 대진표 생성, 피드, H2H, 멘션
├── components/            # 87개 React 컴포넌트
│   ├── ui/                # 디자인 시스템 (Button, Card, Modal, Toast 등)
│   ├── club/              # 클럽 관련
│   ├── match/             # 경기/대진표 관련
│   ├── media/             # 게시물, 좋아요, 댓글
│   ├── feed/              # 피드 리스트
│   ├── profile/           # 프로필
│   └── layout/            # TopBar, BottomNav
├── lib/
│   ├── actions/           # 서버 액션 (56개)
│   ├── queries/           # DB 쿼리 (60+개)
│   ├── draw-engine/       # 대진표 생성 엔진
│   ├── validations/       # Zod 스키마
│   └── utils/             # 권한, 포맷, 유틸리티
├── types/                 # TypeScript 타입 정의
└── supabase/migrations/   # DB 마이그레이션 (28개)
```

## 관련 문서

- [DESIGN.md](DESIGN.md) — 디자인 시스템 (컬러, 타이포, 컴포넌트 API)
- [TODOS.md](TODOS.md) — 우선순위별 로드맵
- [docs/DRAW_RULES.md](docs/DRAW_RULES.md) — 대진표 알고리즘 규칙
- [docs/APP_REVIEW_REPORT.md](docs/APP_REVIEW_REPORT.md) — 종합 앱 리뷰 (2026-03-29)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — 아키텍처 상세

## 라이선스

Private
