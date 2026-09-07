'use client';

import { forwardRef } from 'react';

// ── Types (mirrored from draw page) ──

type GameData = {
  id: string;
  court_number: number;
  game_order: number;
  team_a_player1_id: string | null;
  team_a_player2_id: string | null;
  team_b_player1_id: string | null;
  team_b_player2_id: string | null;
  score_team_a: number | null;
  score_team_b: number | null;
  winner: string | null;
  status: string;
};

type Participant = {
  id: string;
  name: string;
  drawName: string;
  /** 실명 우선 짧은 이름 — 공유 이미지는 칸이 좁아 이걸 쓴다 */
  shortName?: string;
  gender: string | null;
  ntrp: number | null;
};

type GameType = 'mixed' | 'mens' | 'womens' | 'free';

type TimeSlot = { startTime: string; endTime: string };

export interface DrawShareImageProps {
  matchTitle: string;
  matchDate: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  courtCount: number;
  drawType: string;
  gamesByOrder: Record<number, GameData[]>;
  sortedOrders: number[];
  timeSlots: Record<number, TimeSlot>;
  participantMap: Record<string, Participant>;
  courtNames: Record<number, string>;
  sitOutsBySlot: Record<number, string[]>;
  clubName?: string;
  clubLogoDataUrl?: string | null;
}

function initialOf(name: string): string {
  return name?.trim()?.[0]?.toUpperCase() || 'T';
}

// ── Helpers ──

const GAME_TYPE_STYLES: Record<GameType, { bg: string; text: string; label: string }> = {
  mixed: { bg: '#00E67626', text: '#00E676', label: '혼복' },
  mens: { bg: '#40C4FF26', text: '#40C4FF', label: '남복' },
  womens: { bg: '#FF80AB26', text: '#FF80AB', label: '여복' },
  free: { bg: '#99999926', text: '#999999', label: '자유' },
};

function inferGameType(
  game: GameData,
  participantMap: Record<string, Participant>
): GameType {
  const ids = [
    game.team_a_player1_id,
    game.team_a_player2_id,
    game.team_b_player1_id,
    game.team_b_player2_id,
  ].filter(Boolean) as string[];

  const genders = ids.map((id) => participantMap[id]?.gender).filter(Boolean);
  const males = genders.filter((g) => g === 'M').length;
  const females = genders.filter((g) => g === 'F').length;

  if (males > 0 && females > 0) return 'mixed';
  if (males > 0 && females === 0) return 'mens';
  if (females > 0 && males === 0) return 'womens';
  return 'free';
}

type NameParts = { main: string; sub: string | null };

// ⚠️ html2canvas는 overflow:hidden + text-overflow:ellipsis를 정확히 못 그려서
// 글자 아래쪽이 잘린다(클립 박스를 글리프보다 낮게 계산). 그래서 CSS 말줄임 대신
// JS로 미리 폭에 맞게 잘라 넘침 자체를 없앤다. 한글≈1, 영문/숫자≈0.55 단위.
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

/**
 * 팀 이름 칸 — 실명(크게) + 닉네임(작게·회색) 2단 표기.
 * html2canvas가 CSS 말줄임을 못 그리므로 fitText로 미리 잘라 넘침을 원천 차단.
 * 각 선수는 항상 2줄(닉네임 없어도 자리 유지)이라 모든 카드 높이가 같다.
 */
function TeamNames({
  a,
  b,
  nameSize,
  subSize,
  mainMax,
  subMax,
}: {
  a: NameParts | null;
  b: NameParts | null;
  nameSize: number;
  subSize: number;
  mainMax: number;
  subMax: number;
}) {
  const mainLine: React.CSSProperties = {
    fontSize: nameSize,
    fontWeight: 700,
    color: '#EEEEEE',
    lineHeight: 1.45,
    whiteSpace: 'nowrap',
  };
  const subLine: React.CSSProperties = {
    fontSize: subSize,
    fontWeight: 500,
    color: '#8F8F8F',
    lineHeight: 1.45,
    whiteSpace: 'nowrap',
  };
  const renderPlayer = (p: NameParts | null, key: string) => (
    <div key={key} style={{ minWidth: 0 }}>
      <div style={mainLine}>{p ? fitText(p.main, mainMax) : ' '}</div>
      <div style={subLine}>{p?.sub ? fitText(p.sub, subMax) : ' '}</div>
    </div>
  );
  return (
    <div style={{ flex: '1 1 0', minWidth: 0, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
      {renderPlayer(a, 'a')}
      {renderPlayer(b, 'b')}
    </div>
  );

}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[d.getDay()];
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')} (${weekday})`;
}

// ── Component ──
// Renders a static, image-friendly layout. Uses inline styles for html2canvas compatibility.

export const DrawShareImage = forwardRef<HTMLDivElement, DrawShareImageProps>(
  function DrawShareImage(
    {
      matchTitle,
      matchDate,
      startTime,
      courtCount,
      drawType,
      gamesByOrder,
      sortedOrders,
      timeSlots,
      participantMap,
      courtNames,
      sitOutsBySlot,
      clubName,
      clubLogoDataUrl,
    },
    ref
  ) {
    // 실명을 메인으로, 닉네임은 서브 줄로 분리해 표기한다.
    // ('실명(닉네임)' 한 줄 표기는 좁은 칸에서 잘리거나 카드 크기를 흐트러뜨림)
    const getPlayerParts = (id: string | null): NameParts | null => {
      if (!id) return null;
      const p = participantMap[id];
      if (!p) return { main: '???', sub: null };
      const main = p.shortName || p.drawName || p.name || '???';
      // 닉네임이 실명과 같으면(또는 실명이 없어 main이 닉네임이면) 서브 줄 생략
      const sub = p.name && p.name !== main ? p.name : null;
      return { main, sub };
    };

    // 한눈에 읽히도록 큼직하게. 코트가 많을수록 카드가 좁아지므로 이름 크기만 動적.
    const nameSize = courtCount >= 3 ? 19 : 22;
    const subSize = courtCount >= 3 ? 12 : 14;
    const scoreSize = courtCount >= 3 ? 28 : 34;
    // 팀 칸 폭 기반 글자 예산(한글 1단위 기준). 2코트: 칸≈175px/22px, 3코트+: ≈92px/19px
    const mainMax = courtCount >= 3 ? 4.5 : 7.5;
    const subMax = courtCount >= 3 ? 7 : 12;

    return (
      <div
        ref={ref}
        style={{
          width: 1080,
          minHeight: 400,
          background: 'linear-gradient(180deg, #0F0F0F 0%, #111111 100%)',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans KR", sans-serif',
          color: '#EEEEEE',
          // 하단을 넉넉히: html2canvas가 scale 캡처 시 소수점 반올림으로
          // 마지막 몇 px을 잘라내는 문제 대비
          padding: '48px 48px 64px',
          boxSizing: 'border-box',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 20,
            marginBottom: 6,
          }}
        >
          {/* minWidth:0 — 공백 없는 긴 경기 제목이 클럽 로고를 밀어내지 않도록 */}
          <div style={{ paddingTop: 4, flex: '1 1 0', minWidth: 0 }}>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                color: '#00E676',
                letterSpacing: '-0.5px',
                marginBottom: 14,
              }}
            >
              TENOL
            </div>
            {/* Title — overflow:hidden 금지(html2canvas가 글자 하단을 잘라냄).
                넘침은 fitText로 사전 차단, 길면 자연 줄바꿈. */}
            <div
              style={{
                fontSize: 44,
                fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: '-1px',
                lineHeight: 1.3,
                marginBottom: 8,
              }}
            >
              {fitText(matchTitle, 34)}
            </div>
            {/* Date & time & type */}
            <div style={{ fontSize: 21, color: '#999999' }}>
              {formatDate(matchDate)} &middot; {startTime} 시작 &middot; {drawType} &middot; {courtCount}코트
            </div>
          </div>

          {/* 클럽 로고 — 오른쪽 위, 그린 그라디언트 링으로 어두운 로고도 배경에서 분리 */}
          {(clubName || clubLogoDataUrl) && (
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
                  width: 140,
                  height: 140,
                  borderRadius: 31,
                  overflow: 'hidden',
                  background: 'rgba(0,230,118,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {clubLogoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={clubLogoDataUrl}
                    alt={clubName || 'club'}
                    width={140}
                    height={140}
                    style={{ width: 140, height: 140, objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ color: '#69F0AE', fontWeight: 800, fontSize: 58 }}>
                    {initialOf(clubName || '')}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ marginBottom: 34 }} />

        {/* Divider */}
        <div
          style={{
            height: 1,
            background: 'linear-gradient(90deg, #00E676 0%, #00E67600 100%)',
            marginBottom: 32,
          }}
        />

        {/* ── Time Slots ── */}
        {sortedOrders.map((order, slotIdx) => {
          const slotGames = [...(gamesByOrder[order] || [])].sort(
            (a, b) => a.court_number - b.court_number
          );
          const slot = timeSlots[order];
          const sitOuts = sitOutsBySlot[order] || [];

          return (
            <div key={order} style={{ marginBottom: slotIdx < sortedOrders.length - 1 ? 32 : 0 }}>
              {/* Slot header */}
              <div style={{ marginBottom: 16 }}>
                <span
                  style={{
                    fontSize: 24,
                    fontWeight: 800,
                    color: '#00E676',
                  }}
                >
                  {order}경기
                </span>
                <span style={{ fontSize: 19, color: '#888888', marginLeft: 14 }}>
                  {slot?.startTime || '--:--'} ~ {slot?.endTime || '--:--'}
                </span>
              </div>

              {/* Court cards */}
              <div
                style={{
                  display: 'grid',
                  // minmax(0, 1fr) 필수: 그냥 1fr이면 최소폭이 '내용 크기'라
                  // 긴 이름이 든 코트 칸만 넓어진다(칸 크기 불일치의 실제 원인).
                  gridTemplateColumns: `repeat(${courtCount}, minmax(0, 1fr))`,
                  gap: 12,
                }}
              >
                {slotGames.map((game) => {
                  const gameType = inferGameType(game, participantMap);
                  const typeStyle = GAME_TYPE_STYLES[gameType];
                  const courtName =
                    courtNames[game.court_number] || `${game.court_number}코트`;
                  const hasScore = game.score_team_a !== null;

                  return (
                    <div
                      key={game.id}
                      style={{
                        background: '#1A1A1A',
                        border: '1px solid #2A2A2A',
                        borderRadius: 16,
                        padding: '20px 22px',
                        boxSizing: 'border-box',
                        minWidth: 0, // 그리드 칸을 넘어 늘어나지 않도록
                        overflow: 'hidden',
                      }}
                    >
                      {/* Court name + game type */}
                      <div style={{ marginBottom: 16 }}>
                        <span
                          style={{
                            fontSize: 19,
                            fontWeight: 700,
                            color: '#DDDDDD',
                          }}
                        >
                          {courtName}
                        </span>
                        <span
                          style={{
                            fontSize: 17,
                            fontWeight: 700,
                            color: typeStyle.text,
                            marginLeft: 10,
                          }}
                        >
                          {typeStyle.label}
                        </span>
                      </div>

                      {/* Team A vs Team B */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}
                      >
                        {/* Team A */}
                        <TeamNames
                          a={getPlayerParts(game.team_a_player1_id)}
                          b={getPlayerParts(game.team_a_player2_id)}
                          nameSize={nameSize}
                          subSize={subSize}
                          mainMax={mainMax}
                          subMax={subMax}
                        />

                        {/* Score / VS */}
                        <div
                          style={{
                            width: 92,
                            flexShrink: 0,
                            textAlign: 'center',
                            padding: '0 8px',
                          }}
                        >
                          {hasScore ? (
                            <div style={{ fontSize: scoreSize, fontWeight: 800 }}>
                              <span
                                style={{
                                  color:
                                    game.winner === 'team_a' ? '#00E676' : '#EEEEEE',
                                }}
                              >
                                {game.score_team_a}
                              </span>
                              <span style={{ color: '#555555', margin: '0 6px' }}>:</span>
                              <span
                                style={{
                                  color:
                                    game.winner === 'team_b' ? '#00E676' : '#EEEEEE',
                                }}
                              >
                                {game.score_team_b}
                              </span>
                            </div>
                          ) : (
                            <span
                              style={{
                                fontSize: 19,
                                fontWeight: 800,
                                color: '#00E676',
                                letterSpacing: '2px',
                              }}
                            >
                              VS
                            </span>
                          )}
                        </div>

                        {/* Team B */}
                        <TeamNames
                          a={getPlayerParts(game.team_b_player1_id)}
                          b={getPlayerParts(game.team_b_player2_id)}
                          nameSize={nameSize}
                          subSize={subSize}
                          mainMax={mainMax}
                          subMax={subMax}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sit-out players */}
              {sitOuts.length > 0 && (
                <div
                  style={{
                    fontSize: 17,
                    color: '#888888',
                    marginTop: 12,
                    paddingLeft: 4,
                  }}
                >
                  {order}경기 대기: {sitOuts.join(', ')}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Footer / Watermark ── */}
        <div
          style={{
            marginTop: 40,
            paddingTop: 20,
            borderTop: '1px solid #222222',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 16, color: '#666666' }}>
            테놀 - 테니스 치며 놀자
          </div>
          <div style={{ fontSize: 15, color: '#555555' }}>
            tenol.app
          </div>
        </div>
      </div>
    );
  }
);
