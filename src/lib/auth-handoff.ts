// 네이티브 앱 로그인 세션 핸드오프 저장소.
//
// 배경: Capacitor WebView는 외부 호스트(OAuth 공급자)로의 이동을 가로채
// 외부 브라우저를 띄우므로, 로그인은 외부 브라우저에서 완료되고 세션도
// 그 브라우저의 쿠키 저장소에만 남는다. 또한 커스텀 스킴 딥링크는 서버
// 리다이렉트에서 신뢰할 수 없다(iOS 18.4+는 쿼리 파라미터까지 제거).
//
// 해결: 앱이 만든 일회용 토큰을 키로 세션을 잠시 보관하고, 앱 WebView가
// 같은 도메인 폴링(/api/auth/handoff)으로 세션을 HTTP 쿠키로 받아간다.
// 저장소는 service_role 전용 private Supabase Storage 버킷을 사용한다
// (DDL 불필요 — 서버 코드만으로 운영 가능).
//
// 보안:
// - 토큰은 앱이 crypto.getRandomValues로 생성한 192비트 난수 (추측 불가)
// - 세션은 claim 시 즉시 삭제 (일회용), TTL 5분 초과 시 폐기
// - 버킷은 private + service_role 키로만 접근 (익명/사용자 키 차단 확인됨)

const BUCKET = 'auth-handoff';
const TTL_MS = 5 * 60 * 1000;
const CLEANUP_AGE_MS = 15 * 60 * 1000;

// 네이티브 로그인 여부만 표시하는 마커 쿠키 (비밀 아님).
// claim 토큰은 서버가 콜백에서 생성하며 URL로 받지 않는다 — 공격자가 토큰을
// 골라 피해자 세션을 자신이 아는 키에 저장시키는 세션 고정 공격을 막기 위함.
export const HANDOFF_MARKER_COOKIE = 'tenol-handoff-native';
export const HANDOFF_TOKEN_RE = /^[a-f0-9]{48}$/;

/** claim 토큰 생성: 192비트 난수 hex (서버 전용, 피해자 기기에만 전달) */
export function makeHandoffToken(): string {
  const bytes = new Uint8Array(24);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

interface StoredHandoff {
  access_token: string;
  refresh_token: string;
  created_at: number;
}

function storageBase(): { url: string; headers: Record<string, string> } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return {
    url: `${url}/storage/v1`,
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  };
}

/** 외부 브라우저에서 완료된 세션을 토큰 키로 보관 */
export async function storeHandoffSession(
  token: string,
  session: { access_token: string; refresh_token: string }
): Promise<boolean> {
  const base = storageBase();
  if (!base || !HANDOFF_TOKEN_RE.test(token)) return false;

  const body: StoredHandoff = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    created_at: Date.now(),
  };
  // x-upsert: 콜백이 재시도로 중복 호출돼도 성공 처리 (POST 단독은 중복 시 실패)
  const res = await fetch(`${base.url}/object/${BUCKET}/${token}.json`, {
    method: 'POST',
    headers: { ...base.headers, 'Content-Type': 'application/json', 'x-upsert': 'true' },
    body: JSON.stringify(body),
  });
  // 오래된 미수령 객체 정리는 실패해도 무방 (서버리스 함수가 응답 후 얼어붙기 전에
  // 실행되도록 await하되 에러는 무시). 목록 조회 비용이 있으나 저트래픽이라 무해.
  try {
    await cleanupStaleHandoffs();
  } catch {}
  return res.ok;
}

/** 세션을 단 한 번 꺼내가고 즉시 삭제. 없거나 만료면 null */
export async function claimHandoffSession(
  token: string
): Promise<{ access_token: string; refresh_token: string } | null> {
  const base = storageBase();
  if (!base || !HANDOFF_TOKEN_RE.test(token)) return null;

  // 내용 읽기. Supabase Storage 읽기는 CDN 캐시를 타므로 삭제 후에도 캐시된
  // 200이 올 수 있다 → 일회용 판정은 읽기가 아니라 아래 '삭제'가 담당한다.
  // (캐시 우회를 위해 유일 쿼리 파라미터 부여)
  const bust = makeHandoffToken();
  const res = await fetch(`${base.url}/object/${BUCKET}/${token}.json?_=${bust}`, {
    headers: base.headers,
    cache: 'no-store',
  });
  if (!res.ok) return null;

  let stored: StoredHandoff;
  try {
    stored = (await res.json()) as StoredHandoff;
  } catch {
    return null;
  }

  // 일회용의 진짜 관문: 배치 삭제(원자적 DELETE … RETURNING).
  // 동시/재요청이 있어도 실제로 행을 지운 요청만 객체 메타를 돌려받는다.
  // 반환 배열이 비어 있으면 이미 소비된 것(리플레이) → 세션 미반환.
  const del = await fetch(`${base.url}/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...base.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: [`${token}.json`] }),
  });
  if (!del.ok) return null;
  let deleted: unknown;
  try {
    deleted = await del.json();
  } catch {
    return null;
  }
  const weClaimed = Array.isArray(deleted) && deleted.length > 0;
  if (!weClaimed) return null; // 이미 소비됨 — 우리가 지운 게 아님

  // TTL·필수 필드 검증 (만료/손상 객체는 소비만 하고 세션은 주지 않음)
  const valid =
    !!stored?.access_token &&
    !!stored?.refresh_token &&
    !!stored?.created_at &&
    Date.now() - stored.created_at <= TTL_MS;
  if (!valid) return null;

  return { access_token: stored.access_token, refresh_token: stored.refresh_token };
}

/** 수령되지 않고 남은 오래된 세션 객체 삭제 (리프레시 토큰을 저장소에 방치하지 않기 위함) */
async function cleanupStaleHandoffs(): Promise<void> {
  const base = storageBase();
  if (!base) return;

  const res = await fetch(`${base.url}/object/list/${BUCKET}`, {
    method: 'POST',
    headers: { ...base.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prefix: '',
      limit: 100,
      sortBy: { column: 'created_at', order: 'asc' },
    }),
  });
  if (!res.ok) return;

  const objects = (await res.json()) as Array<{ name: string; created_at: string }>;
  const stale = objects
    .filter((o) => Date.now() - new Date(o.created_at).getTime() > CLEANUP_AGE_MS)
    .map((o) => o.name);
  if (stale.length === 0) return;

  await fetch(`${base.url}/object/${BUCKET}`, {
    method: 'DELETE',
    headers: { ...base.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ prefixes: stale }),
  });
}
