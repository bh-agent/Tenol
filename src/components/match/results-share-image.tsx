'use client';

import { forwardRef } from 'react';

type MvpEntry = {
  displayName: string;
  avgScore: number;
  wins: number;
  totalScore: number;
  gamesPlayed: number;
};

type Highlight = {
  icon: string;
  label: string;
  description: string;
};

type FunStat = {
  label: string;
  value: string;
  sub?: string;
};

type GameResult = {
  gameOrder: number;
  courtNumber: number;
  teamANames: string;
  teamBNames: string;
  scoreA: number;
  scoreB: number;
  winner: string | null;
};

export interface ResultsShareImageProps {
  matchTitle: string;
  matchDate: string;
  mvpTop3: MvpEntry[];
  highlights: Highlight[];
  funStats: FunStat[];
  gameResults: GameResult[];
}

const MEDAL_COLORS = ['#FFD740', '#C0C0C0', '#CD7F32'];
const MEDAL_EMOJI = ['👑', '🥈', '🥉'];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${weekdays[d.getDay()]})`;
}

export const ResultsShareImage = forwardRef<HTMLDivElement, ResultsShareImageProps>(
  function ResultsShareImage({ matchTitle, matchDate, mvpTop3, highlights, funStats, gameResults }, ref) {
    // Group games by order
    const gamesByOrder: Record<number, GameResult[]> = {};
    for (const g of gameResults) {
      if (!gamesByOrder[g.gameOrder]) gamesByOrder[g.gameOrder] = [];
      gamesByOrder[g.gameOrder].push(g);
    }
    const slotOrders = Object.keys(gamesByOrder).map(Number).sort((a, b) => a - b);

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          minHeight: 400,
          background: 'linear-gradient(180deg, #0F0F0F 0%, #111111 100%)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
          color: '#EEEEEE',
          padding: 48,
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: '#00E676', letterSpacing: '-0.5px' }}>TENOL</span>
          <span style={{ fontSize: 13, color: '#666666', float: 'right' }}>경기 결과</span>
        </div>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF', marginBottom: 6 }}>{matchTitle}</div>
        <div style={{ fontSize: 16, color: '#888888', marginBottom: 36 }}>{formatDate(matchDate)}</div>
        <div style={{ height: 1, background: 'linear-gradient(90deg, #00E676 0%, #00E67600 100%)', marginBottom: 32 }} />

        {/* MVP Top 3 */}
        {mvpTop3.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', marginBottom: 16 }}>
              🏆 오늘의 MVP
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: mvpTop3.length >= 3 ? '1fr 1fr 1fr' : `repeat(${mvpTop3.length}, 1fr)`, gap: 12 }}>
              {mvpTop3.map((mvp, i) => (
                <div
                  key={i}
                  style={{
                    background: '#1A1A1A',
                    border: `1px solid ${MEDAL_COLORS[i]}30`,
                    borderRadius: 16,
                    padding: '20px 16px',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{MEDAL_EMOJI[i]}</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#FFFFFF', marginBottom: 4 }}>{mvp.displayName}</div>
                  <div style={{ fontSize: 28, fontWeight: 800, color: MEDAL_COLORS[i], marginBottom: 4 }}>{mvp.avgScore}</div>
                  <div style={{ fontSize: 11, color: '#888888' }}>평균 득점</div>
                  <div style={{ marginTop: 12, fontSize: 12, color: '#AAAAAA' }}>
                    {mvp.wins}승 · {mvp.totalScore}점 · {mvp.gamesPlayed}경기
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Highlights */}
        {highlights.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', marginBottom: 16 }}>오늘의 명장면</div>
            <div style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 16, padding: '12px 20px' }}>
              {highlights.map((h, i) => (
                <div key={i} style={{ padding: '10px 0', borderBottom: i < highlights.length - 1 ? '1px solid #222222' : 'none' }}>
                  <span style={{ fontSize: 14 }}>{h.icon} </span>
                  <span style={{ fontSize: 13, color: '#888888' }}>{h.label}: </span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#EEEEEE' }}>{h.description}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fun Stats */}
        {funStats.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', marginBottom: 16 }}>재미있는 통계</div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(funStats.length, 4)}, 1fr)`, gap: 12 }}>
              {funStats.map((s, i) => (
                <div key={i} style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 12, padding: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#888888', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: i === 0 ? '#00E676' : '#EEEEEE' }}>{s.value}</div>
                  {s.sub && <div style={{ fontSize: 10, color: '#666666', marginTop: 2 }}>{s.sub}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Game Results */}
        {slotOrders.length > 0 && (
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFF', marginBottom: 16 }}>게임별 결과</div>
            {slotOrders.map((order) => {
              const slotGames = gamesByOrder[order].sort((a, b) => a.courtNumber - b.courtNumber);
              return (
                <div key={order} style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#00E676', marginBottom: 8 }}>
                    {order}경기
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(slotGames.length, 3)}, 1fr)`, gap: 10 }}>
                    {slotGames.map((game, i) => (
                      <div key={i} style={{ background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 12, padding: '12px 16px' }}>
                        <div style={{ fontSize: 11, color: '#666666', marginBottom: 8 }}>{game.courtNumber}코트</div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 13, fontWeight: game.winner === 'team_a' ? 700 : 400, color: game.winner === 'team_a' ? '#EEEEEE' : '#777777', marginBottom: 4 }}>{game.teamANames}</div>
                          <div style={{ fontSize: 20, fontWeight: 800, margin: '4px 0' }}>
                            <span style={{ color: game.winner === 'team_a' ? '#00E676' : '#EEEEEE' }}>{game.scoreA}</span>
                            <span style={{ color: '#555555', margin: '0 6px' }}>:</span>
                            <span style={{ color: game.winner === 'team_b' ? '#00E676' : '#EEEEEE' }}>{game.scoreB}</span>
                          </div>
                          <div style={{ fontSize: 13, fontWeight: game.winner === 'team_b' ? 700 : 400, color: game.winner === 'team_b' ? '#EEEEEE' : '#777777' }}>{game.teamBNames}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #222222' }}>
          <span style={{ fontSize: 13, color: '#555555' }}>테놀 - 테니스 치며 놀자</span>
          <span style={{ fontSize: 12, color: '#444444', float: 'right' }}>tenol.app</span>
        </div>
      </div>
    );
  }
);
