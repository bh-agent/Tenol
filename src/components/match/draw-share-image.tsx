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
    },
    ref
  ) {
    const getPlayerName = (id: string | null) =>
      id ? participantMap[id]?.drawName || participantMap[id]?.name || '???' : '-';

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
          padding: 48,
          boxSizing: 'border-box',
        }}
      >
        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 12,
          }}
        >
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: '#00E676',
              letterSpacing: '-0.5px',
            }}
          >
            TENOL
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#666666',
            }}
          >
            {drawType} &middot; {courtCount}코트
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 32,
            fontWeight: 800,
            color: '#FFFFFF',
            letterSpacing: '-0.5px',
            marginBottom: 6,
          }}
        >
          {matchTitle}
        </div>

        {/* Date & time */}
        <div
          style={{
            fontSize: 16,
            color: '#888888',
            marginBottom: 36,
          }}
        >
          {formatDate(matchDate)} &middot; {startTime} 시작
        </div>

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
                    fontSize: 15,
                    fontWeight: 800,
                    color: '#00E676',
                  }}
                >
                  {order}경기
                </span>
                <span style={{ fontSize: 14, color: '#777777', marginLeft: 12 }}>
                  {slot?.startTime || '--:--'} ~ {slot?.endTime || '--:--'}
                </span>
              </div>

              {/* Court cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${courtCount}, 1fr)`,
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
                        padding: '16px 20px',
                        boxSizing: 'border-box',
                      }}
                    >
                      {/* Court name + game type */}
                      <div style={{ marginBottom: 16 }}>
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#DDDDDD',
                          }}
                        >
                          {courtName}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
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
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: '#EEEEEE',
                              lineHeight: '1.6',
                            }}
                          >
                            {getPlayerName(game.team_a_player1_id)}
                          </div>
                          {game.team_a_player2_id && (
                            <div
                              style={{
                                fontSize: 16,
                                fontWeight: 600,
                                color: '#EEEEEE',
                                lineHeight: '1.6',
                              }}
                            >
                              {getPlayerName(game.team_a_player2_id)}
                            </div>
                          )}
                        </div>

                        {/* Score / VS */}
                        <div
                          style={{
                            minWidth: 80,
                            textAlign: 'center',
                            padding: '0 8px',
                          }}
                        >
                          {hasScore ? (
                            <div style={{ fontSize: 24, fontWeight: 800 }}>
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
                                fontSize: 14,
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
                        <div style={{ flex: 1, textAlign: 'center' }}>
                          <div
                            style={{
                              fontSize: 16,
                              fontWeight: 600,
                              color: '#EEEEEE',
                              lineHeight: '1.6',
                            }}
                          >
                            {getPlayerName(game.team_b_player1_id)}
                          </div>
                          {game.team_b_player2_id && (
                            <div
                              style={{
                                fontSize: 16,
                                fontWeight: 600,
                                color: '#EEEEEE',
                                lineHeight: '1.6',
                              }}
                            >
                              {getPlayerName(game.team_b_player2_id)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sit-out players */}
              {sitOuts.length > 0 && (
                <div
                  style={{
                    fontSize: 13,
                    color: '#777777',
                    marginTop: 10,
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
          <div style={{ fontSize: 13, color: '#555555' }}>
            테놀 - 테니스 치며 놀자
          </div>
          <div style={{ fontSize: 12, color: '#444444' }}>
            tenol.app
          </div>
        </div>
      </div>
    );
  }
);
