'use client';

import { forwardRef } from 'react';

type MvpEntry = {
  displayName: string;
  avatarDataUrl: string | null;
  ntrpLevel: number | null;
  avgScore: number;
  wins: number;
  totalScore: number;
  gamesPlayed: number;
  rank: number;
  tied: boolean;
};

function rankLabel(e: { rank: number; tied: boolean }): string {
  return `${e.tied ? '공동 ' : ''}${e.rank}위`;
}

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
  teamAPlayer1: string;
  teamAPlayer2: string | null;
  teamBPlayer1: string;
  teamBPlayer2: string | null;
  scoreA: number;
  scoreB: number;
  winner: string | null;
};

export interface ResultsShareImageProps {
  clubName: string;
  clubLogoDataUrl: string | null;
  matchTitle: string;
  matchDate: string;
  mvpTop3: MvpEntry[];
  highlights: Highlight[];
  funStats: FunStat[];
  gameResults: GameResult[];
}

// 앱 화면(results/page.tsx)과 동일한 디자인 언어. html2canvas가 color-mix/backdrop-blur/
// gradient 유틸을 못 그리므로, 모든 색은 인라인 hex/rgba로 직접 지정한다.
const GOLD = '#FFD740';
const SILVER = '#C0C0C0';
const BRONZE = '#CD7F32';
const GREEN = '#00E676';
const GREEN_LIGHT = '#69F0AE';
const MEDAL = [
  { accent: GOLD, emoji: '👑' },
  { accent: SILVER, emoji: '🥈' },
  { accent: BRONZE, emoji: '🥉' },
];

const CARD_BG = '#141414';
const CHIP_BG = '#1C1C1C';
const BORDER = '#2A2A2A';
const MUTED = '#A3A3A3';
const SUBTLE = '#7A7A7A';

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} (${weekdays[d.getDay()]})`;
}

function initialOf(name: string): string {
  return name?.[0]?.toUpperCase() || '?';
}

// 원형 아바타 + ring/offset. html2canvas 안정성을 위해 중첩 div로 ring을 표현.
function RingAvatar({
  src,
  name,
  size,
  ring,
}: {
  src: string | null;
  name: string;
  size: number;
  ring: string;
}) {
  const gap = 3;
  const ringW = 3;
  return (
    <div
      style={{
        width: size + (gap + ringW) * 2,
        height: size + (gap + ringW) * 2,
        borderRadius: 9999,
        background: ring,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: size + gap * 2,
          height: size + gap * 2,
          borderRadius: 9999,
          background: '#0A0A0A',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            width: size,
            height: size,
            borderRadius: 9999,
            overflow: 'hidden',
            background: 'rgba(0,230,118,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={name} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover' }} />
          ) : (
            <span style={{ color: GREEN_LIGHT, fontWeight: 800, fontSize: Math.round(size * 0.4) }}>{initialOf(name)}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// 클럽 로고(둥근 사각형). 없으면 클럽명 이니셜.
function ClubLogo({ src, name }: { src: string | null; name: string }) {
  const size = 56;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'rgba(0,230,118,0.15)',
        border: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover' }} />
      ) : (
        <span style={{ color: GREEN_LIGHT, fontWeight: 800, fontSize: 24 }}>{initialOf(name || 'T')}</span>
      )}
    </div>
  );
}

function PlayerNames({
  p1,
  p2,
  win,
  align,
}: {
  p1: string;
  p2: string | null;
  win: boolean;
  align: 'left' | 'right';
}) {
  return (
    <div style={{ flex: 1, textAlign: align }}>
      <div style={{ fontSize: 20, fontWeight: win ? 700 : 400, color: win ? '#F5F5F5' : MUTED }}>{p1}</div>
      {p2 && (
        <div style={{ fontSize: 20, fontWeight: win ? 700 : 400, color: win ? '#F5F5F5' : MUTED, marginTop: 3 }}>
          {p2}
        </div>
      )}
    </div>
  );
}

export const ResultsShareImage = forwardRef<HTMLDivElement, ResultsShareImageProps>(
  function ResultsShareImage({ clubName, clubLogoDataUrl, matchTitle, matchDate, mvpTop3, highlights, funStats, gameResults }, ref) {
    const first = mvpTop3[0];
    const rest = mvpTop3.slice(1, 3);

    // 게임 결과: 슬롯(game_order)별 그룹
    const gamesByOrder: Record<number, GameResult[]> = {};
    for (const g of gameResults) {
      if (!gamesByOrder[g.gameOrder]) gamesByOrder[g.gameOrder] = [];
      gamesByOrder[g.gameOrder].push(g);
    }
    const slotOrders = Object.keys(gamesByOrder).map(Number).sort((a, b) => a - b);

    const sectionTitle: React.CSSProperties = {
      fontSize: 26,
      fontWeight: 800,
      color: '#FFFFFF',
      marginBottom: 18,
    };

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          minHeight: 400,
          background: '#0A0A0A',
          fontFamily: "'Pretendard Variable', Pretendard, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans KR', sans-serif",
          color: '#F5F5F5',
          padding: 56,
          boxSizing: 'border-box',
        }}
      >
        {/* Header — 클럽 로고 + 클럽명 브랜딩 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 22 }}>
          <ClubLogo src={clubLogoDataUrl} name={clubName} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: '#FFFFFF', lineHeight: 1.15 }}>{clubName || '테놀'}</div>
            <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.3px', color: GREEN, marginTop: 3 }}>TENOL · 경기 결과</div>
          </div>
        </div>
        <div style={{ fontSize: 38, fontWeight: 800, color: '#FFFFFF', marginBottom: 6 }}>{matchTitle}</div>
        <div style={{ fontSize: 17, color: MUTED, marginBottom: 32 }}>{formatDate(matchDate)}</div>
        <div style={{ height: 2, background: 'linear-gradient(90deg, #00E676 0%, rgba(0,230,118,0) 100%)', marginBottom: 40 }} />

        {/* ═══ MVP Top 3 ═══ */}
        {first && (
          <div style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <span style={{ fontSize: 30 }}>🏆</span>
              <span style={{ fontSize: 28, fontWeight: 800, color: '#FFFFFF' }}>오늘의 MVP</span>
            </div>

            {/* 1st place */}
            <div
              style={{
                position: 'relative',
                overflow: 'hidden',
                background: CARD_BG,
                border: `1px solid ${GOLD}4D`,
                borderRadius: 20,
                padding: 32,
                marginBottom: 16,
              }}
            >
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${GOLD}, #FFA000, ${GOLD})` }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ fontSize: 40, marginBottom: 6 }}>{MEDAL[Math.min(first.rank - 1, 2)].emoji}</span>
                <RingAvatar src={first.avatarDataUrl} name={first.displayName} size={96} ring={`${GOLD}80`} />
                <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '0.5px', color: GOLD, marginTop: 10 }}>{rankLabel(first)}</div>
                <div style={{ fontSize: 26, fontWeight: 800, color: '#FFFFFF', marginTop: 4 }}>{first.displayName}</div>
              </div>
              <div style={{ display: 'flex', marginTop: 24, paddingTop: 24, borderTop: `1px solid ${GOLD}1A` }}>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>평균 득점</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: GOLD }}>{first.avgScore}</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>승수</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: GREEN }}>{first.wins}승</div>
                </div>
                <div style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ fontSize: 13, color: MUTED, marginBottom: 4 }}>총 득점</div>
                  <div style={{ fontSize: 30, fontWeight: 800, color: '#F5F5F5' }}>{first.totalScore}</div>
                </div>
              </div>
            </div>

            {/* 2nd & 3rd */}
            {rest.length > 0 && (
              <div style={{ display: 'flex', gap: 16 }}>
                {rest.map((mvp, i) => {
                  const m = MEDAL[Math.min(mvp.rank - 1, 2)];
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        position: 'relative',
                        overflow: 'hidden',
                        background: CARD_BG,
                        border: `1px solid ${m.accent}33`,
                        borderRadius: 16,
                        padding: 24,
                      }}
                    >
                      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, rgba(0,0,0,0), ${m.accent}, rgba(0,0,0,0))` }} />
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span style={{ fontSize: 26, marginBottom: 4 }}>{m.emoji}</span>
                        <RingAvatar src={mvp.avatarDataUrl} name={mvp.displayName} size={72} ring={`${m.accent}80`} />
                        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: '0.5px', color: m.accent, marginTop: 8 }}>{rankLabel(mvp)}</div>
                        <div style={{ fontSize: 20, fontWeight: 700, color: '#F5F5F5', marginTop: 3 }}>{mvp.displayName}</div>
                      </div>
                      <div style={{ display: 'flex', marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>평균</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: m.accent }}>{mvp.avgScore}</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 12, color: MUTED, marginBottom: 4 }}>승수</div>
                          <div style={{ fontSize: 22, fontWeight: 800, color: GREEN }}>{mvp.wins}승</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ Highlights ═══ */}
        {highlights.length > 0 && (
          <div style={{ marginBottom: 44 }}>
            <div style={sectionTitle}>오늘의 명장면</div>
            <div style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '8px 24px' }}>
              {highlights.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 0',
                    borderBottom: i < highlights.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                  }}
                >
                  <div style={{ width: 44, height: 44, borderRadius: 9999, background: CHIP_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                    {h.icon}
                  </div>
                  <div style={{ fontSize: 18, flex: 1 }}>
                    <span style={{ color: MUTED }}>{h.label}: </span>
                    <span style={{ fontWeight: 700, color: '#F5F5F5' }}>{h.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ═══ Fun Stats ═══ */}
        {funStats.length > 0 && (
          <div style={{ marginBottom: 44 }}>
            <div style={sectionTitle}>재미있는 통계</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
              {funStats.map((s, i) => {
                const isFirst = i === 0;
                return (
                  <div
                    key={i}
                    style={{
                      width: 'calc(50% - 8px)',
                      boxSizing: 'border-box',
                      background: CARD_BG,
                      border: `1px solid ${isFirst ? GREEN + '4D' : BORDER}`,
                      borderRadius: 14,
                      padding: 20,
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 13, color: MUTED, marginBottom: 6 }}>{s.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: isFirst ? GREEN : '#F5F5F5' }}>{s.value}</div>
                    {s.sub && <div style={{ fontSize: 12, color: SUBTLE, marginTop: 4 }}>{s.sub}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ Game Results ═══ */}
        {slotOrders.length > 0 && (
          <div>
            <div style={sectionTitle}>게임별 결과</div>
            {slotOrders.map((order) => {
              const slotGames = gamesByOrder[order].sort((a, b) => a.courtNumber - b.courtNumber);
              return (
                <div key={order} style={{ marginBottom: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 9999, background: GREEN }} />
                    <span style={{ fontSize: 15, fontWeight: 600, color: MUTED }}>{order}경기</span>
                    <div style={{ flex: 1, height: 1, background: BORDER }} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {slotGames.map((game, i) => {
                      const aWin = game.winner === 'team_a';
                      const bWin = game.winner === 'team_b';
                      return (
                        <div key={i} style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: MUTED, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '2px 8px' }}>
                              {game.courtNumber}코트
                            </span>
                            {game.winner ? <span style={{ fontSize: 15 }}>🏆</span> : <span />}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center' }}>
                            <PlayerNames p1={game.teamAPlayer1} p2={game.teamAPlayer2} win={aWin} align="right" />
                            <div style={{ minWidth: 96, textAlign: 'center', padding: '0 12px' }}>
                              <span style={{ fontSize: 26, fontWeight: 800 }}>
                                <span style={{ color: aWin ? GREEN : MUTED }}>{game.scoreA}</span>
                                <span style={{ color: SUBTLE, margin: '0 8px' }}>:</span>
                                <span style={{ color: bWin ? GREEN : MUTED }}>{game.scoreB}</span>
                              </span>
                            </div>
                            <PlayerNames p1={game.teamBPlayer1} p2={game.teamBPlayer2} win={bWin} align="left" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 44, paddingTop: 24, borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, color: SUBTLE }}>테놀 - 테니스 치며 놀자</span>
          <span style={{ fontSize: 14, color: '#555555' }}>tenol.app</span>
        </div>
      </div>
    );
  }
);
