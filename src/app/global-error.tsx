'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
    // Report to server
    fetch('/api/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level: 'error',
        category: 'client',
        message: error.message || 'Unknown error',
        errorName: error.name,
        errorStack: error.stack,
        errorDigest: error.digest,
        path: window.location.pathname,
      }),
    }).catch(() => {}); // Never block on logging
  }, [error]);

  return (
    <html lang="ko">
      <head>
        <title>오류 발생 - 테놀</title>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Pretendard Variable', 'Pretendard', -apple-system, sans-serif",
          background: '#0A0A0A',
          color: '#F5F5F5',
          padding: '1.5rem',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'rgba(255, 82, 82, 0.12)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            fontSize: 28,
            color: '#FF5252',
            fontWeight: 600,
          }}
        >
          !
        </div>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
          앱에 문제가 발생했어요
        </h2>
        <p style={{ fontSize: 14, color: '#8A8A8A', marginBottom: 24, maxWidth: 280 }}>
          예기치 않은 오류가 발생했습니다. 아래 버튼을 눌러 다시 시도해주세요.
        </p>
        <button
          onClick={() => unstable_retry()}
          style={{
            background: '#00E676',
            color: '#0A0A0A',
            border: 'none',
            borderRadius: 12,
            padding: '12px 24px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
