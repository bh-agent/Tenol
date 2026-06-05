import { describe, it, expect } from 'vitest';
import { generateDrawV2, type DrawMode, type GameSlot } from './index';
import type { MatchParticipant } from '@/types';

// ============================================================
// Test fixtures
// ============================================================

let seq = 0;
function makeParticipant(
  gender: 'M' | 'F' | null,
  ntrp: number,
  status: MatchParticipant['status'] = 'confirmed',
): MatchParticipant {
  seq += 1;
  return {
    id: `p${seq}`,
    match_id: 'm1',
    user_id: `u${seq}`,
    guest_name: null,
    guest_phone: null,
    guest_gender: gender,
    participant_type: 'member',
    status,
    ntrp_override: ntrp,
    introduction: null,
    requested_at: '2026-01-01T00:00:00Z',
    responded_at: null,
    responded_by: null,
  } as MatchParticipant;
}

function makeRoster(males: number, females: number, ntrp = 3.0): MatchParticipant[] {
  const roster: MatchParticipant[] = [];
  for (let i = 0; i < males; i++) roster.push(makeParticipant('M', ntrp + (i % 3) * 0.5));
  for (let i = 0; i < females; i++) roster.push(makeParticipant('F', ntrp + (i % 3) * 0.5));
  return roster;
}

function genderOf(p: MatchParticipant): 'M' | 'F' | null {
  return p.guest_gender ?? p.profiles?.gender ?? null;
}

function playersOf(g: GameSlot): MatchParticipant[] {
  return [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2];
}

const baseInput = (participants: MatchParticipant[], mode: DrawMode, courts = 2, gamesPerCourt = 3) => ({
  participants,
  courts: Array.from({ length: courts }, (_, i) => ({ name: `${i + 1}코트` })),
  gamesPerCourt,
  mode,
  startTime: '08:00',
  timeSlotMinutes: 30,
});

// ============================================================
// Structural invariants (hold for every mode)
// ============================================================

describe('generateDrawV2 — structural invariants', () => {
  const modes: DrawMode[] = ['mixed_all', 'mixed_only', 'gendered_only', 'free'];

  for (const mode of modes) {
    it(`[${mode}] produces games with 4 distinct players each`, () => {
      const result = generateDrawV2(baseInput(makeRoster(4, 4), mode));
      expect(result.games.length).toBeGreaterThan(0);
      for (const g of result.games) {
        const ids = playersOf(g).map((p) => p.id);
        expect(new Set(ids).size).toBe(4); // no player twice in one game
      }
    });

    it(`[${mode}] never double-books a player or court within a time slot`, () => {
      const result = generateDrawV2(baseInput(makeRoster(4, 4), mode));
      const slots = new Map<number, { players: Set<string>; courts: Set<number> }>();
      for (const g of result.games) {
        const slot = slots.get(g.timeSlotIndex) ?? { players: new Set(), courts: new Set() };
        // court not reused in the same slot
        expect(slot.courts.has(g.courtIndex)).toBe(false);
        slot.courts.add(g.courtIndex);
        // player not booked twice in the same slot
        for (const p of playersOf(g)) {
          expect(slot.players.has(p.id)).toBe(false);
          slot.players.add(p.id);
        }
        slots.set(g.timeSlotIndex, slot);
      }
    });

    it(`[${mode}] reports every confirmed player in playerSummary`, () => {
      const roster = makeRoster(4, 4);
      const result = generateDrawV2(baseInput(roster, mode));
      expect(result.playerSummary.length).toBe(roster.length);
      for (const s of result.playerSummary) {
        // totalGames matches actual appearances
        const appearances = result.games.filter((g) =>
          playersOf(g).some((p) => p.id === s.participant.id),
        ).length;
        expect(s.totalGames).toBe(appearances);
      }
    });

    it(`[${mode}] time slots are within games-per-court bound and times are well-formed`, () => {
      const result = generateDrawV2(baseInput(makeRoster(4, 4), mode, 2, 3));
      for (const g of result.games) {
        expect(g.timeSlotIndex).toBeGreaterThanOrEqual(0);
        expect(g.timeSlotIndex).toBeLessThan(3);
        expect(g.startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(g.endTime).toMatch(/^\d{2}:\d{2}$/);
      }
    });
  }
});

// ============================================================
// Game-type composition correctness
// ============================================================

describe('generateDrawV2 — game-type composition', () => {
  it('labels a game "mens" only when all four players are male', () => {
    const result = generateDrawV2(baseInput(makeRoster(8, 0), 'gendered_only'));
    for (const g of result.games.filter((x) => x.gameType === 'mens')) {
      expect(playersOf(g).every((p) => genderOf(p) === 'M')).toBe(true);
    }
  });

  it('labels a game "womens" only when all four players are female', () => {
    const result = generateDrawV2(baseInput(makeRoster(0, 8), 'gendered_only'));
    for (const g of result.games.filter((x) => x.gameType === 'womens')) {
      expect(playersOf(g).every((p) => genderOf(p) === 'F')).toBe(true);
    }
  });

  it('labels a game "mixed" only when composition is exactly 2M + 2F', () => {
    const result = generateDrawV2(baseInput(makeRoster(4, 4), 'mixed_only'));
    for (const g of result.games.filter((x) => x.gameType === 'mixed')) {
      const males = playersOf(g).filter((p) => genderOf(p) === 'M').length;
      const females = playersOf(g).filter((p) => genderOf(p) === 'F').length;
      expect(males).toBe(2);
      expect(females).toBe(2);
    }
  });
});

// ============================================================
// Guard rails / error conditions
// ============================================================

describe('generateDrawV2 — guards', () => {
  it('throws when fewer than 4 confirmed participants', () => {
    expect(() => generateDrawV2(baseInput(makeRoster(2, 1), 'free'))).toThrow();
  });

  it('ignores non-confirmed participants when counting the minimum', () => {
    const roster = [
      ...makeRoster(2, 2), // 4 confirmed
      makeParticipant('M', 3.0, 'pending'),
      makeParticipant('F', 3.0, 'waitlisted'),
    ];
    expect(() => generateDrawV2(baseInput(roster, 'free'))).not.toThrow();
  });

  it('throws in mixed_only when one gender is entirely absent', () => {
    expect(() => generateDrawV2(baseInput(makeRoster(8, 0), 'mixed_only'))).toThrow();
  });

  it('falls back gracefully (no throw) when genders are largely unknown', () => {
    const roster = [
      makeParticipant(null, 3.0),
      makeParticipant(null, 3.0),
      makeParticipant(null, 3.0),
      makeParticipant(null, 3.0),
      makeParticipant('M', 3.0),
      makeParticipant('F', 3.0),
    ];
    // mode is mixed_all but >30% unknown → engine should downgrade to free, not crash
    expect(() => generateDrawV2(baseInput(roster, 'mixed_all'))).not.toThrow();
  });
});
