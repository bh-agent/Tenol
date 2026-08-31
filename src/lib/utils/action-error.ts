import { ZodError } from 'zod';

/**
 * 서버 액션의 예상 가능한 에러를 사용자에게 그대로 전달하기 위한 정규화 헬퍼.
 *
 * Next.js 프로덕션은 서버 액션이 throw한 Error 메시지를 보안상 가리고 generic
 * 영어 메시지로 대체한다. 따라서 액션은 throw 대신 { error } 를 "반환"하고,
 * 클라이언트가 이 문자열을 그대로 표시해야 한국어 사유가 사용자에게 노출된다.
 * (권한/상태 체크 등에서 던진 한국어 throw는 액션을 try/catch로 감싸 이 헬퍼로
 *  정규화한다. Zod 입력 검증 실패는 영어이므로 사용자 친화 fallback으로 대체.)
 */
export function actionError(e: unknown, fallback: string): { error: string } {
  if (e instanceof ZodError) return { error: fallback };
  return { error: e instanceof Error && e.message ? e.message : fallback };
}
