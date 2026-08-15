/**
 * 서버 액션의 redirect()가 던지는 내부 신호(NEXT_REDIRECT)인지 판별.
 *
 * 서버 액션 안에서 redirect()를 호출하면 특수 에러를 throw하는데,
 * 클라이언트 try/catch가 이를 일반 에러로 잡으면 "NEXT_REDIRECT"가
 * 사용자에게 표시되고 페이지 이동이 막힌다.
 *
 * 사용 규칙:
 * - startTransition/form action 안의 catch: `if (isRedirectError(e)) throw e;`
 *   → 다시 던지면 Next가 정상적으로 이동을 처리한다.
 * - 일반 onClick 핸들러의 catch: `if (isRedirectError(e)) { router.replace(...); return; }`
 *   → transition 밖에서는 Next가 처리하지 못하므로 직접 이동한다.
 */
export function isRedirectError(e: unknown): boolean {
  if (typeof e !== 'object' || e === null) return false;
  const digest = (e as { digest?: unknown }).digest;
  if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) return true;
  const message = (e as { message?: unknown }).message;
  return typeof message === 'string' && message.includes('NEXT_REDIRECT');
}
