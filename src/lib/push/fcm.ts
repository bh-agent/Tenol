import crypto from 'node:crypto';

// FCM HTTP v1 발송 모듈 (서버 전용)
// 필요한 환경 변수 (Firebase 서비스 계정 JSON에서 추출):
//   FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
// 셋 중 하나라도 없으면 모든 함수가 안전하게 no-op 처리된다.
// 자세한 설정은 docs/PUSH_SETUP.md 참고.

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.FCM_PROJECT_ID &&
      process.env.FCM_CLIENT_EMAIL &&
      process.env.FCM_PRIVATE_KEY,
  );
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

// 액세스 토큰 캐시 (만료 60초 전까지 재사용)
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string | null> {
  if (!isPushConfigured()) return null;

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }

  const clientEmail = process.env.FCM_CLIENT_EMAIL!;
  // 환경 변수에 \n 이 리터럴로 들어간 경우를 복원
  const privateKey = process.env.FCM_PRIVATE_KEY!.replace(/\\n/g, '\n');

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: FCM_SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claim}`;
  const signature = base64url(
    crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey),
  );
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!res.ok) return null;
  const json = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!json.access_token) return null;

  cachedToken = {
    value: json.access_token,
    expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000,
  };
  return json.access_token;
}

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

/**
 * 단일 디바이스 토큰으로 푸시 발송.
 * @returns 'ok' | 'invalid' (토큰 폐기 권장) | 'skipped' (미설정) | 'error'
 */
export async function sendToToken(
  deviceToken: string,
  payload: PushPayload,
): Promise<'ok' | 'invalid' | 'skipped' | 'error'> {
  const accessToken = await getAccessToken();
  if (!accessToken) return 'skipped';

  const projectId = process.env.FCM_PROJECT_ID!;
  const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

  // data 값은 FCM 규격상 모두 문자열이어야 한다.
  const stringData: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload.data ?? {})) {
    stringData[k] = String(v);
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: payload.title, body: payload.body },
        data: stringData,
        apns: {
          payload: { aps: { sound: 'default' } },
        },
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
      },
    }),
  });

  if (res.ok) return 'ok';
  // 404/400 UNREGISTERED → 토큰 무효
  if (res.status === 404 || res.status === 400) return 'invalid';
  return 'error';
}
