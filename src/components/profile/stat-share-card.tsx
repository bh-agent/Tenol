'use client';

import { useCallback, useState } from 'react';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Share2, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast-provider';
import type { ProfileStats } from '@/lib/queries/profile-stats';

// ── Types ──

export type StatShareCardProps = {
  displayName: string;
  avatarUrl: string | null;
  stats: ProfileStats;
};

// ── Share Image (static, inline styles for html2canvas) ──

function StatShareImage({
  displayName,
  avatarUrl,
  stats,
}: StatShareCardProps) {
  const { totalGames, wins, losses, draws, winRate, avgScore, recentGames } =
    stats;

  // Win rate for the circular gauge
  const gaugeAngle = (winRate / 100) * 360;

  return (
    <div
      style={{
        width: 1080,
        height: 1080,
        background: 'linear-gradient(160deg, #0A0A0A 0%, #0F1A12 40%, #0A0A0A 100%)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
        color: '#EEEEEE',
        padding: 72,
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background glow effects */}
      <div
        style={{
          position: 'absolute',
          top: -120,
          right: -120,
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,230,118,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -80,
          left: -80,
          width: 300,
          height: 300,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,230,118,0.05) 0%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* ── Header: Brand ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 48,
        }}
      >
        <div
          style={{
            fontSize: 28,
            fontWeight: 900,
            color: '#00E676',
            letterSpacing: '-0.5px',
          }}
        >
          TENOL
        </div>
        <div
          style={{
            fontSize: 16,
            color: '#555555',
            fontWeight: 500,
          }}
        >
          MY TENNIS STATS
        </div>
      </div>

      {/* ── Profile section ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          marginBottom: 48,
        }}
      >
        {/* Avatar */}
        <div
          style={{
            width: 96,
            height: 96,
            borderRadius: '50%',
            background: avatarUrl
              ? undefined
              : 'linear-gradient(135deg, #00E676 0%, #00C853 100%)',
            border: '3px solid #00E676',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
              crossOrigin="anonymous"
            />
          ) : (
            <span
              style={{
                fontSize: 40,
                fontWeight: 800,
                color: '#0A0A0A',
              }}
            >
              {displayName[0]?.toUpperCase() || '?'}
            </span>
          )}
        </div>
        <div>
          <div
            style={{
              fontSize: 36,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.5px',
              lineHeight: 1.2,
            }}
          >
            {displayName}
          </div>
          <div
            style={{
              fontSize: 16,
              color: '#777777',
              marginTop: 4,
            }}
          >
            {totalGames > 0
              ? `${totalGames}경기 플레이`
              : '아직 경기 기록이 없어요'}
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div
        style={{
          height: 1,
          background:
            'linear-gradient(90deg, #00E676 0%, rgba(0,230,118,0.2) 50%, transparent 100%)',
          marginBottom: 48,
        }}
      />

      {/* ── Main stats grid ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr 1fr',
          gap: 20,
          marginBottom: 48,
        }}
      >
        {/* Win Rate */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(0,230,118,0.12) 0%, rgba(0,230,118,0.04) 100%)',
            border: '1px solid rgba(0,230,118,0.2)',
            borderRadius: 24,
            padding: '28px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: '#888888', marginBottom: 8, fontWeight: 600 }}>
            승률
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: '#00E676',
              lineHeight: 1,
            }}
          >
            {winRate}
            <span style={{ fontSize: 24 }}>%</span>
          </div>
        </div>

        {/* Total Games */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: '28px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: '#888888', marginBottom: 8, fontWeight: 600 }}>
            총 경기
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: '#FFFFFF',
              lineHeight: 1,
            }}
          >
            {totalGames}
          </div>
        </div>

        {/* Avg Score */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: '28px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: '#888888', marginBottom: 8, fontWeight: 600 }}>
            평균 득점
          </div>
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: '#FFFFFF',
              lineHeight: 1,
            }}
          >
            {avgScore}
          </div>
        </div>

        {/* W/L/D */}
        <div
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 24,
            padding: '28px 16px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 14, color: '#888888', marginBottom: 8, fontWeight: 600 }}>
            승 / 패 / 무
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, lineHeight: 1 }}>
            <span style={{ color: '#00E676' }}>{wins}</span>
            <span style={{ color: '#555555', margin: '0 4px' }}>/</span>
            <span style={{ color: '#FF5252' }}>{losses}</span>
            <span style={{ color: '#555555', margin: '0 4px' }}>/</span>
            <span style={{ color: '#FFD740' }}>{draws}</span>
          </div>
        </div>
      </div>

      {/* ── Recent 5 Games ── */}
      {recentGames.length > 0 && (
        <div style={{ marginBottom: 'auto' }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#999999',
              marginBottom: 16,
              letterSpacing: '1px',
              textTransform: 'uppercase',
            }}
          >
            최근 {recentGames.length}경기
          </div>
          <div
            style={{
              display: 'flex',
              gap: 12,
            }}
          >
            {recentGames.map((game, i) => {
              const isWin = game.result === 'win';
              const isDraw = game.result === 'draw';
              const bg = isWin
                ? 'linear-gradient(135deg, rgba(0,230,118,0.15) 0%, rgba(0,230,118,0.05) 100%)'
                : isDraw
                  ? 'linear-gradient(135deg, rgba(255,215,64,0.15) 0%, rgba(255,215,64,0.05) 100%)'
                  : 'linear-gradient(135deg, rgba(255,82,82,0.15) 0%, rgba(255,82,82,0.05) 100%)';
              const borderColor = isWin
                ? 'rgba(0,230,118,0.3)'
                : isDraw
                  ? 'rgba(255,215,64,0.3)'
                  : 'rgba(255,82,82,0.3)';
              const labelColor = isWin ? '#00E676' : isDraw ? '#FFD740' : '#FF5252';
              const label = isWin ? 'W' : isDraw ? 'D' : 'L';

              return (
                <div
                  key={i}
                  style={{
                    flex: 1,
                    background: bg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 20,
                    padding: '20px 12px',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 28,
                      fontWeight: 900,
                      color: labelColor,
                      marginBottom: 8,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      color: '#CCCCCC',
                    }}
                  >
                    {game.myScore}:{game.opponentScore}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Footer / Watermark ── */}
      <div
        style={{
          marginTop: 48,
          paddingTop: 24,
          borderTop: '1px solid #222222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ fontSize: 16, color: '#555555', fontWeight: 500 }}>
          테놀 - 테니스 치며 놀자
        </div>
        <div style={{ fontSize: 14, color: '#444444' }}>tenol.app</div>
      </div>
    </div>
  );
}

// ── Share Button Component ──

export function StatShareButton({ displayName, avatarUrl, stats }: StatShareCardProps) {
  const toast = useToast();
  const [sharing, setSharing] = useState(false);

  const handleShare = useCallback(async () => {
    if (stats.totalGames === 0) {
      toast.warning('공유할 경기 기록이 없어요');
      return;
    }

    setSharing(true);
    try {
      const html2canvasModule = await import('html2canvas').catch(() => null);
      if (!html2canvasModule) {
        toast.error('이미지 생성 라이브러리를 로드할 수 없습니다.');
        return;
      }
      const html2canvas = html2canvasModule.default;

      const props: StatShareCardProps = { displayName, avatarUrl, stats };

      const tempContainer = document.createElement('div');
      tempContainer.style.cssText =
        'position:absolute;left:0;top:0;z-index:99999;pointer-events:none;';
      document.body.appendChild(tempContainer);

      let root: ReturnType<typeof createRoot> | null = null;
      try {
        root = createRoot(tempContainer);
        flushSync(() => {
          root!.render(createElement(StatShareImage, props));
        });
        await new Promise((r) => setTimeout(r, 100));

        const target = tempContainer.firstElementChild as HTMLElement;
        if (!target) return;

        const canvas = await html2canvas(target, {
          backgroundColor: '#0A0A0A',
          scale: 2,
          useCORS: true,
          logging: false,
        });

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/png')
        );
        if (!blob) return;

        const fileName = `테놀_전적_${displayName}.png`;

        if (
          navigator.share &&
          navigator.canShare?.({
            files: [new File([blob], 'stats.png', { type: 'image/png' })],
          })
        ) {
          await navigator.share({
            files: [new File([blob], fileName, { type: 'image/png' })],
            title: `${displayName}의 테니스 전적`,
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          a.click();
          URL.revokeObjectURL(url);
          toast.success('이미지가 다운로드되었습니다');
        }
      } finally {
        root?.unmount();
        document.body.removeChild(tempContainer);
      }
    } catch (e) {
      if ((e as Error)?.name !== 'AbortError') {
        toast.error('이미지 공유에 실패했습니다');
      }
    } finally {
      setSharing(false);
    }
  }, [displayName, avatarUrl, stats, toast]);

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleShare}
      disabled={sharing}
      className="gap-1.5"
    >
      {sharing ? (
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Share2 className="w-3.5 h-3.5" />
      )}
      {sharing ? '생성 중...' : '내 전적 공유'}
    </Button>
  );
}
