---
name: vercel-deploy
description: 현재 변경 사항을 빌드 확인 후 커밋, 푸시하고 Vercel 프로덕션에 배포한다. "배포해줘", "deploy", "vercel 배포", "프로덕션 반영", "푸시하고 배포" 같은 요청에 사용한다. 코드 변경 후 배포가 필요할 때 자동으로 이 스킬을 사용한다.
---

# Vercel Deploy

현재 변경 사항을 커밋, 푸시하고 Vercel 프로덕션에 배포한다.

## 실행 순서

### 1. 빌드 확인
`npm run build`를 실행하여 빌드가 통과하는지 확인한다. 실패하면 중단하고 에러를 보고한다.

### 2. 변경 사항 확인
`git status`와 `git diff --stat`으로 변경 사항을 확인한다. 변경 사항이 없으면 "커밋할 변경 사항이 없습니다"라고 알리고 중단한다.

### 3. 커밋
- `git status`로 변경된 파일 목록을 확인한다.
- 변경 내용을 분석하여 커밋 메시지를 자동 생성한다.
  - feat/fix/refactor 등 conventional commit 형식 사용
  - 한국어로 간결하게 작성
  - Co-Authored-By 라인 포함
- 관련 파일들만 `git add`로 스테이징한다. (.env, credentials 등 민감 파일 제외)
- 커밋을 생성한다.

### 4. 푸시
`git push origin <현재브랜치>`로 원격에 푸시한다.

### 5. Vercel 프로덕션 배포
`npx vercel --prod`를 실행한다. 타임아웃은 3분으로 설정한다.

### 6. 결과 보고
배포 완료 후 아래 정보를 보고한다:
- 커밋 해시 및 메시지
- 변경된 파일 수 및 줄 수
- 배포 URL
- 배포 상태 (Ready/Error)

## 주의사항
- 빌드 실패 시 배포하지 않는다.
- pre-commit hook을 건너뛰지 않는다 (--no-verify 금지).
- force push를 하지 않는다.
- .env, credentials, 시크릿 파일은 커밋하지 않는다.
