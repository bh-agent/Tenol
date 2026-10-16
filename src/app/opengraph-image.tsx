import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * 링크 미리보기(카톡·슬랙 등) 기본 이미지. 1200×630.
 * 이전엔 512px 앱 아이콘을 그대로 써서 작고 정사각형으로 잘려 보였다.
 * 한글 폰트는 빌드 시 CDN에서 받아 쓰고, 실패하면 아이콘만 그린다(빌드는 깨지지 않음).
 */
export const alt = '테놀 - 테니스 치며 놀자';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const PRETENDARD_BOLD = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff/Pretendard-Bold.woff';

async function loadFont(): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(PRETENDARD_BOLD);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function Image() {
  const [font, icon] = await Promise.all([
    loadFont(),
    readFile(path.join(process.cwd(), 'public/icons/icon-512.png')),
  ]);
  const iconSrc = `data:image/png;base64,${icon.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 72,
          background: 'linear-gradient(135deg, #0A0A0A 0%, #0F1A12 100%)',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={iconSrc} width={300} height={300} alt="" style={{ borderRadius: 64 }} />
        {font && (
          <div style={{ display: 'flex', flexDirection: 'column', fontFamily: 'Pretendard' }}>
            <div style={{ fontSize: 132, fontWeight: 700, color: '#00E676', lineHeight: 1.05 }}>테놀</div>
            <div style={{ fontSize: 52, fontWeight: 700, color: '#F5F5F5', marginTop: 12 }}>테니스 치며 놀자</div>
            <div style={{ fontSize: 30, fontWeight: 700, color: '#A3A3A3', marginTop: 20 }}>
              테니스 클럽 운영 · 대진표 · 경기 기록 · MVP
            </div>
          </div>
        )}
      </div>
    ),
    {
      ...size,
      fonts: font ? [{ name: 'Pretendard', data: font, weight: 700, style: 'normal' }] : undefined,
    },
  );
}
