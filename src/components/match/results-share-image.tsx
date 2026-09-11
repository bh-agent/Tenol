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

type PlayerResult = {
  displayName: string;
  wins: number;
  losses: number;
  totalScore: number;
  rank: number;
  tied: boolean;
};

export interface ResultsShareImageProps {
  clubName: string;
  clubLogoDataUrl: string | null;
  matchTitle: string;
  matchDate: string;
  mvpTop3: MvpEntry[];
  highlights: Highlight[];
  funStats: FunStat[];
  playerResults: PlayerResult[];
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

// ⚠️ html2canvas는 텍스트 요소의 overflow:hidden + ellipsis를 못 그려 글자 하단을
// 잘라낸다. CSS 말줄임 대신 JS로 폭에 맞게 미리 잘라 넘침을 원천 차단한다.
// (한글≈1, 영문/숫자≈0.55 단위)
function textUnits(s: string): number {
  let u = 0;
  for (const ch of s) u += ch.charCodeAt(0) > 0x2e7f ? 1 : 0.55;
  return u;
}
function fitText(s: string, maxUnits: number): string {
  if (textUnits(s) <= maxUnits) return s;
  let out = '';
  let u = 0;
  for (const ch of s) {
    const w = ch.charCodeAt(0) > 0x2e7f ? 1 : 0.55;
    if (u + w > maxUnits - 1) break;
    out += ch;
    u += w;
  }
  return out + '…';
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

// 클럽 로고 — 그린 그라디언트 링으로 어두운 로고도 검은 배경에서 분리, 크게.
function ClubLogo({ src, name }: { src: string | null; name: string }) {
  const size = 140;
  return (
    <div
      style={{
        padding: 5,
        borderRadius: 36,
        background: 'linear-gradient(135deg, #00E676 0%, #69F0AE 50%, #00A857 100%)',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: size,
          height: size,
          borderRadius: 31,
          overflow: 'hidden',
          background: 'rgba(0,230,118,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name} width={size} height={size} style={{ width: size, height: size, objectFit: 'cover' }} />
        ) : (
          <span style={{ color: GREEN_LIGHT, fontWeight: 800, fontSize: 58 }}>{initialOf(name || 'T')}</span>
        )}
      </div>
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
    // flex '1 1 0' + minWidth 0: 긴 이름이 칸을 밀어내 점수가 중앙에서 벗어나는 것 방지.
    // CSS 말줄임은 html2canvas가 글자 하단을 잘라내므로 fitText로 사전 절단.
    <div style={{ flex: '1 1 0', minWidth: 0, textAlign: align }}>
      <div style={{ fontSize: 24, fontWeight: win ? 700 : 500, color: win ? '#F5F5F5' : MUTED, whiteSpace: 'nowrap', lineHeight: 1.45 }}>{fitText(p1, 16)}</div>
      {p2 && (
        <div style={{ fontSize: 24, fontWeight: win ? 700 : 500, color: win ? '#F5F5F5' : MUTED, marginTop: 4, whiteSpace: 'nowrap', lineHeight: 1.45 }}>
          {fitText(p2, 16)}
        </div>
      )}
    </div>
  );
}

export const ResultsShareImage = forwardRef<HTMLDivElement, ResultsShareImageProps>(
  function ResultsShareImage({ clubName, clubLogoDataUrl, matchTitle, matchDate, mvpTop3, highlights, funStats, playerResults }, ref) {
    // 공동 순위 그룹 — 공동 1위는 전원 금색 카드, 2·3위(공동 포함)는 그리드
    const firstGroup = mvpTop3.filter((e) => e.rank === 1);
    const restGroup = mvpTop3.filter((e) => e.rank > 1);

    const sectionTitle: React.CSSProperties = {
      fontSize: 30,
      fontWeight: 800,
      color: '#FFFFFF',
      marginBottom: 20,
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
        {/* Header — 왼쪽 텍스트 + 오른쪽 위 큰 클럽 로고 (인스타 스토리 프로필에 안 가림) */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, marginBottom: 32 }}>
          {/* minWidth:0 — 공백 없는 긴 경기 제목이 클럽 로고를 밀어내지 않도록 */}
          <div style={{ paddingTop: 4, flex: '1 1 0', minWidth: 0 }}>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.3px', color: GREEN, marginBottom: 14 }}>TENOL · 경기 결과</div>
            <div style={{ fontSize: 42, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-1px', lineHeight: 1.3, marginBottom: 8 }}>{fitText(matchTitle, 34)}</div>
            <div style={{ fontSize: 19, color: MUTED }}>{formatDate(matchDate)}</div>
          </div>
          <ClubLogo src={clubLogoDataUrl} name={clubName} />
        </div>
        <div style={{ height: 2, background: 'linear-gradient(90deg, #00E676 0%, rgba(0,230,118,0) 100%)', marginBottom: 40 }} />

        {/* ═══ MVP (공동 순위 전원) ═══ */}
        {firstGroup.length > 0 && (
          <div style={{ marginBottom: 44 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
              <span style={{ fontSize: 34 }}>🏆</span>
              <span style={{ fontSize: 32, fontWeight: 800, color: '#FFFFFF' }}>오늘의 MVP</span>
            </div>

            {/* 1위 그룹 — 공동 1위면 나란히 */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              {firstGroup.map((first, fi) => (
              <div
                key={fi}
                style={{
                  flex: '1 1 0',
                  minWidth: 0,
                  position: 'relative',
                  overflow: 'hidden',
                  background: CARD_BG,
                  border: `1px solid ${GOLD}4D`,
                  borderRadius: 20,
                  padding: firstGroup.length > 1 ? 24 : 32,
                }}
              >
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: `linear-gradient(90deg, ${GOLD}, #FFA000, ${GOLD})` }} />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{ fontSize: 46, marginBottom: 6 }}>{MEDAL[0].emoji}</span>
                  <RingAvatar src={first.avatarDataUrl} name={first.displayName} size={firstGroup.length > 1 ? 92 : 110} ring={`${GOLD}80`} />
                  <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.5px', color: GOLD, marginTop: 12 }}>{rankLabel(first)}</div>
                  <div style={{ fontSize: firstGroup.length > 1 ? 27 : 32, fontWeight: 800, color: '#FFFFFF', marginTop: 4, whiteSpace: 'nowrap', lineHeight: 1.45 }}>{fitText(first.displayName, firstGroup.length > 1 ? 14 : 24)}</div>
                </div>
                <div style={{ display: 'flex', marginTop: 26, paddingTop: 26, borderTop: `1px solid ${GOLD}1A` }}>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, color: MUTED, marginBottom: 6 }}>평균 득점</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: GOLD }}>{first.avgScore}</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, color: MUTED, marginBottom: 6 }}>승수</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: GREEN }}>{first.wins}승</div>
                  </div>
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 16, color: MUTED, marginBottom: 6 }}>총 득점</div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: '#F5F5F5' }}>{first.totalScore}</div>
                  </div>
                </div>
              </div>
              ))}
            </div>

            {/* 2·3위 그룹 — 공동 포함 전원, 2열 랩 */}
            {restGroup.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
                {restGroup.map((mvp, i) => {
                  const m = MEDAL[Math.min(mvp.rank - 1, 2)];
                  return (
                    <div
                      key={i}
                      style={{
                        width: 'calc(50% - 8px)',
                        boxSizing: 'border-box',
                        minWidth: 0,
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
                        <span style={{ fontSize: 30, marginBottom: 4 }}>{m.emoji}</span>
                        <RingAvatar src={mvp.avatarDataUrl} name={mvp.displayName} size={84} ring={`${m.accent}80`} />
                        <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '0.5px', color: m.accent, marginTop: 10 }}>{rankLabel(mvp)}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: '#F5F5F5', marginTop: 4, whiteSpace: 'nowrap', lineHeight: 1.45 }}>{fitText(mvp.displayName, 16)}</div>
                      </div>
                      <div style={{ display: 'flex', marginTop: 18, paddingTop: 18, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 15, color: MUTED, marginBottom: 5 }}>평균</div>
                          <div style={{ fontSize: 27, fontWeight: 800, color: m.accent }}>{mvp.avgScore}</div>
                        </div>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div style={{ fontSize: 15, color: MUTED, marginBottom: 5 }}>승수</div>
                          <div style={{ fontSize: 27, fontWeight: 800, color: GREEN }}>{mvp.wins}승</div>
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
                  <div style={{ width: 52, height: 52, borderRadius: 9999, background: CHIP_BG, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, flexShrink: 0 }}>
                    {h.icon}
                  </div>
                  <div style={{ fontSize: 21, flex: 1 }}>
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
                    <div style={{ fontSize: 16, color: MUTED, marginBottom: 8 }}>{s.label}</div>
                    <div style={{ fontSize: 34, fontWeight: 800, color: isFirst ? GREEN : '#F5F5F5' }}>{s.value}</div>
                    {s.sub && <div style={{ fontSize: 15, color: SUBTLE, marginTop: 5 }}>{s.sub}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ 선수별 결과 — 게임별 결과 대체(이미지 길이 대폭 축소) ═══ */}
        {playerResults.length > 0 && (
          <div>
            <div style={sectionTitle}>선수별 결과</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {playerResults.map((p, i) => {
                const isTop = p.rank === 1;
                return (
                  <div
                    key={i}
                    style={{
                      width: 'calc(50% - 6px)',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      background: CARD_BG,
                      border: `1px solid ${isTop ? GOLD + '4D' : BORDER}`,
                      borderRadius: 12,
                      padding: '14px 18px',
                    }}
                  >
                    <span
                      style={{
                        width: 58,
                        flexShrink: 0,
                        fontSize: 15,
                        fontWeight: 800,
                        color: isTop ? GOLD : MUTED,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {rankLabel(p)}
                    </span>
                    <span style={{ flex: '1 1 0', minWidth: 0, fontSize: 21, fontWeight: 700, color: '#F5F5F5', whiteSpace: 'nowrap', lineHeight: 1.45 }}>
                      {fitText(p.displayName, 12)}
                    </span>
                    <span style={{ flexShrink: 0, fontSize: 19, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      <span style={{ color: GREEN }}>{p.wins}승</span>
                      <span style={{ color: SUBTLE, margin: '0 4px' }}>·</span>
                      <span style={{ color: MUTED }}>{p.losses}패</span>
                      <span style={{ color: SUBTLE, margin: '0 4px' }}>·</span>
                      <span style={{ color: '#CCCCCC' }}>{p.totalScore}점</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 44, paddingTop: 24, borderTop: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 16, color: SUBTLE }}>테놀 - 테니스 치며 놀자</span>
          <span style={{ fontSize: 15, color: '#555555' }}>tenol.app</span>
        </div>
      </div>
    );
  }
);
