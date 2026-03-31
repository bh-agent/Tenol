import type { MatchParticipant } from '@/types';

// ============================================================
// V2 Types
// ============================================================

export type DrawMode = 'mixed_all' | 'mixed_only' | 'gendered_only' | 'free';

export type GameType = 'mixed' | 'mens' | 'womens' | 'free';

export type DrawInputV2 = {
  participants: MatchParticipant[];
  courts: { name: string }[];
  gamesPerCourt: number;
  mode: DrawMode;
  startTime: string; // "08:00"
  timeSlotMinutes: number; // 30
};

export type GameSlot = {
  timeSlotIndex: number;
  courtIndex: number;
  courtName: string;
  gameType: GameType;
  teamA: { player1: MatchParticipant; player2: MatchParticipant };
  teamB: { player1: MatchParticipant; player2: MatchParticipant };
  startTime: string;
  endTime: string;
};

export type PlayerSummary = {
  participant: MatchParticipant;
  totalGames: number;
  games: { timeSlotIndex: number; courtName: string; gameType: string; gameOrder: number }[];
};

export type DrawResultV2 = {
  games: GameSlot[];
  playerSummary: PlayerSummary[];
  totalTimeSlots: number;
  sitOuts: { timeSlotIndex: number; players: MatchParticipant[] }[];
};

// ============================================================
// Legacy V1 Types (backward compat)
// ============================================================

export type DrawType = 'mixed_doubles' | 'mens_doubles' | 'womens_doubles' | 'free';

export type TeamPair = {
  player1: MatchParticipant;
  player2: MatchParticipant | null;
};

export type GeneratedGame = {
  court_number: number;
  game_order: number;
  teamA: TeamPair;
  teamB: TeamPair;
};

export type TimeSlot = {
  gameOrder: number;
  startTime: string;
  endTime: string;
  courts: { courtIndex: number; courtName: string; game: GeneratedGame | null }[];
};

export type DrawResult = {
  teams: TeamPair[];
  games: GeneratedGame[];
  timeSlots: TimeSlot[];
  sitOuts: MatchParticipant[];
};

export type DrawInput = {
  participants: MatchParticipant[];
  courtCount: number;
  gamesPerCourt: number;
  drawType: DrawType;
  timeSlotMinutes?: number;
  startTime?: string;
  courtNames?: string[];
};

// ============================================================
// Helpers
// ============================================================

function getNtrp(p: MatchParticipant): number {
  const profiles = Array.isArray((p as any).profiles) ? (p as any).profiles[0] : p.profiles;
  return p.ntrp_override || profiles?.ntrp_level || 3.0;
}

function getGender(p: MatchParticipant): 'M' | 'F' | null {
  // Handle both normalized profiles and raw Supabase join result
  const profiles = Array.isArray((p as any).profiles) ? (p as any).profiles[0] : p.profiles;
  return (profiles?.gender as 'M' | 'F' | null) || p.guest_gender || null;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

function getPlayerId(p: MatchParticipant): string {
  return p.id;
}

// ============================================================
// V2 Engine: Core Algorithm
// ============================================================

/**
 * Plan game type distribution for a given mode and gender counts.
 *
 * For mixed_all, we solve a system of constraints:
 *   mixedGames * 2 + mensGames * 4 = totalMaleSlots
 *   mixedGames * 2 + womensGames * 4 = totalFemaleSlots
 * where totalMaleSlots and totalFemaleSlots are proportional to
 * the number of males and females respectively.
 *
 * The key insight: each player should play ~the same number of games.
 * If we have M males and F females, and each plays G games:
 *   Male player-slots = M * G
 *   Female player-slots = F * G
 *   mixed uses 2M + 2F per game, mens uses 4M, womens uses 4F
 *
 * So: 2*mx + 4*mn = M*G  and  2*mx + 4*wm = F*G
 * Subtracting: 4*mn - 4*wm = (M-F)*G  =>  mn - wm = (M-F)*G/4
 * Also: mx + mn + wm = totalGames
 *
 * We solve for the distribution that best balances play.
 */
function planGameTypes(
  totalGames: number,
  maleCount: number,
  femaleCount: number,
  mode: DrawMode,
): GameType[] {
  if (mode === 'free') {
    return Array(totalGames).fill('free');
  }

  if (mode === 'mixed_only') {
    return Array(totalGames).fill('mixed');
  }

  if (mode === 'gendered_only') {
    if (maleCount < 4 && femaleCount < 4) {
      throw new Error('남복 또는 여복을 진행할 수 있는 충분한 참가자가 없습니다');
    }

    // Solve: 4*mn = M*G, 4*wm = F*G where G = totalGames*4/(M+F)
    // Simplify: mn/wm = M/F ratio of player-slots needed
    // mn = totalGames * M / (M + F), wm = totalGames * F / (M + F)
    // But we need at least 4 of a gender to play gendered games
    let mensGames: number;
    let womensGames: number;
    if (maleCount < 4) {
      mensGames = 0;
      womensGames = totalGames;
    } else if (femaleCount < 4) {
      mensGames = totalGames;
      womensGames = 0;
    } else {
      mensGames = Math.round(totalGames * maleCount / (maleCount + femaleCount));
      womensGames = totalGames - mensGames;
      if (mensGames === 0 && maleCount >= 4) mensGames = 1;
      if (womensGames === 0 && femaleCount >= 4) womensGames = 1;
      // Re-normalize
      if (mensGames + womensGames !== totalGames) {
        if (mensGames > womensGames) mensGames = totalGames - womensGames;
        else womensGames = totalGames - mensGames;
      }
    }

    return interleaveTypes(mensGames, womensGames, 0);
  }

  // mixed_all: find optimal distribution
  // We want every player to play the same number of games (G).
  // totalGames * 4 = total player-slots.
  // G_base = floor(totalGames * 4 / (M + F))
  //
  // Male slots used = 2*mx + 4*mn
  // Female slots used = 2*mx + 4*wm
  // We want: male slots ~= M * G_target, female slots ~= F * G_target
  //
  // From the constraint mx + mn + wm = totalGames:
  //   2*mx + 4*mn = maleSlots    ... (1)
  //   2*mx + 4*wm = femaleSlots  ... (2)
  //   mx + mn + wm = totalGames  ... (3)
  //
  // From (1)-(2): 4*(mn - wm) = maleSlots - femaleSlots
  //   mn - wm = (maleSlots - femaleSlots) / 4
  //
  // We target maleSlots/femaleSlots proportional to M/F:
  //   maleSlots = totalGames * 4 * M / (M + F)
  //   femaleSlots = totalGames * 4 * F / (M + F)
  //
  // From (3): mx = totalGames - mn - wm
  // From (1): 2*(totalGames - mn - wm) + 4*mn = maleSlots
  //   2*totalGames + 2*mn - 2*wm = maleSlots
  //   mn - wm = (maleSlots - 2*totalGames) / 2
  //
  // Similarly from (2): wm - mn = (femaleSlots - 2*totalGames) / 2
  // These are consistent since maleSlots + femaleSlots = 4*totalGames.
  //
  // Let d = mn - wm = (maleSlots - 2*totalGames) / 2
  // From (3): mx = totalGames - mn - wm
  // Also mn = wm + d, so mx = totalGames - 2*wm - d
  // From (2): 2*(totalGames - 2*wm - d) + 4*wm = femaleSlots
  //   2*totalGames - 4*wm - 2*d + 4*wm = femaleSlots
  //   2*totalGames - 2*d = femaleSlots
  //   wm = (femaleSlots - 2*totalGames + 2*d) / 0  -- this is always true (identity)
  //
  // We need another constraint. Let's pick wm directly:
  // From (2): wm = (femaleSlots - 2*mx) / 4
  // From (1): mn = (maleSlots - 2*mx) / 4
  // mx must satisfy: mx >= 0, mn >= 0, wm >= 0
  //   mx <= maleSlots/2, mx <= femaleSlots/2, mx <= totalGames
  //   mx = totalGames - mn - wm

  const totalPlayerSlots = totalGames * 4;
  const totalPlayers = maleCount + femaleCount;
  const maleSlots = Math.round(totalPlayerSlots * maleCount / totalPlayers);
  const femaleSlots = totalPlayerSlots - maleSlots;

  let mixedGames: number;
  let mensGames: number;
  let womensGames: number;

  if (maleCount < 2 || femaleCount < 2) {
    // Cannot do mixed at all
    mixedGames = 0;
    if (maleCount >= 4 && femaleCount >= 4) {
      mensGames = Math.round(totalGames * maleCount / totalPlayers);
      womensGames = totalGames - mensGames;
    } else if (maleCount >= 4) {
      mensGames = totalGames;
      womensGames = 0;
    } else if (femaleCount >= 4) {
      mensGames = 0;
      womensGames = totalGames;
    } else {
      throw new Error('경기를 진행할 수 있는 충분한 참가자가 없습니다');
    }
  } else {
    // We can do mixed games. Now find the right split.
    // mn = (maleSlots - 2*mx) / 4
    // wm = (femaleSlots - 2*mx) / 4
    // We need mn >= 0 => mx <= maleSlots/2
    // We need wm >= 0 => mx <= femaleSlots/2
    // We need mx >= 0
    // Also mn + wm + mx = totalGames => (maleSlots - 2mx)/4 + (femaleSlots - 2mx)/4 + mx = totalGames
    //   (maleSlots + femaleSlots - 4mx)/4 + mx = totalGames
    //   (4*totalGames - 4mx)/4 + mx = totalGames
    //   totalGames - mx + mx = totalGames  (identity! any mx works as long as constraints hold)
    //
    // So we pick mx to maximize mixed games (most fun), subject to:
    //   mx <= maleSlots / 2, mx <= femaleSlots / 2, mx >= 0
    //   mn = (maleSlots - 2*mx) / 4 >= 0  (same as mx <= maleSlots/2)
    //   wm = (femaleSlots - 2*mx) / 4 >= 0  (same as mx <= femaleSlots/2)
    //   Also need maleCount >= 4 for mn > 0, femaleCount >= 4 for wm > 0
    //   mn, wm must be non-negative integers

    const maxMx = Math.min(Math.floor(maleSlots / 2), Math.floor(femaleSlots / 2), totalGames);

    // Target ~50% mixed for good variety (user's preference from example).
    // For 6M+6F, 12 games: target mx=6, which gives mn=3, wm=3. Perfect balance.
    // Each swap of 1 mixed <-> (0.5 mens + 0.5 womens) changes nothing in slot count,
    // but: replacing 2 mixed with 1 mens + 1 womens preserves slot balance:
    //   2 mixed = 4M + 4F slots, 1 mens + 1 womens = 4M + 4F slots.
    //
    // So any mx value where (maleSlots - 2*mx) % 4 == 0 works.
    // Target: ~50% of totalGames as mixed.
    const targetMx = Math.round(totalGames * 0.5);

    // Search outward from target to find valid mx (where remainders are divisible by 4)
    let bestMx = -1;
    for (let delta = 0; delta <= totalGames; delta++) {
      for (const tryMx of [targetMx + delta, targetMx - delta]) {
        if (tryMx < 0 || tryMx > maxMx) continue;
        const remM = maleSlots - 2 * tryMx;
        const remF = femaleSlots - 2 * tryMx;
        if (remM >= 0 && remF >= 0 && remM % 4 === 0 && remF % 4 === 0) {
          bestMx = tryMx;
          break;
        }
      }
      if (bestMx >= 0) break;
    }

    if (bestMx < 0) {
      // Fallback: all mixed
      bestMx = totalGames;
    }

    mixedGames = bestMx;
    mensGames = Math.max(0, (maleSlots - 2 * mixedGames) / 4);
    womensGames = Math.max(0, (femaleSlots - 2 * mixedGames) / 4);

    // Sanity: if mensGames > 0 but maleCount < 4, push to mixed
    if (mensGames > 0 && maleCount < 4) {
      mixedGames += mensGames;
      mensGames = 0;
    }
    if (womensGames > 0 && femaleCount < 4) {
      mixedGames += womensGames;
      womensGames = 0;
    }

    // Ensure we didn't break the total
    const sum = mixedGames + mensGames + womensGames;
    if (sum !== totalGames) {
      // Fallback: simple heuristic
      mixedGames = totalGames;
      mensGames = 0;
      womensGames = 0;
    }

    // Ensure variety: if we have enough of both genders, ensure at least 1 gendered game
    if (mensGames === 0 && womensGames === 0 && maleCount >= 4 && femaleCount >= 4 && totalGames >= 4) {
      // Replacing 2 mixed with 1 mens + 1 womens preserves player-slot balance.
      if (mixedGames >= 4) {
        mixedGames -= 2;
        mensGames = 1;
        womensGames = 1;
      }
    }
  }

  return interleaveTypes(mensGames, womensGames, mixedGames);
}

/**
 * Create an interleaved list of game types for even distribution across time slots.
 */
function interleaveTypes(mensGames: number, womensGames: number, mixedGames: number): GameType[] {
  const types: GameType[] = [];
  let mnR = mensGames;
  let wmR = womensGames;
  let mxR = mixedGames;
  const total = mnR + wmR + mxR;

  for (let i = 0; i < total; i++) {
    const candidates: { type: GameType; remain: number; orig: number }[] = [];
    if (mxR > 0) candidates.push({ type: 'mixed', remain: mxR, orig: mixedGames || 1 });
    if (mnR > 0) candidates.push({ type: 'mens', remain: mnR, orig: mensGames || 1 });
    if (wmR > 0) candidates.push({ type: 'womens', remain: wmR, orig: womensGames || 1 });

    // Sort by highest remaining ratio, break ties by highest remain
    candidates.sort((a, b) => {
      const ratioA = a.remain / a.orig;
      const ratioB = b.remain / b.orig;
      if (Math.abs(ratioA - ratioB) < 0.001) return b.remain - a.remain;
      return ratioB - ratioA;
    });

    const chosen = candidates[0].type;
    types.push(chosen);
    if (chosen === 'mixed') mxR--;
    else if (chosen === 'mens') mnR--;
    else wmR--;
  }

  return types;
}

/**
 * Pair 4 players into 2 balanced teams by NTRP.
 * For mixed (혼복): 1M+1F vs 1M+1F. REQUIRES exactly 2M+2F.
 * For mens/womens/free: highest+lowest vs middle two.
 */
function pairByNtrp(
  players: MatchParticipant[],
  gameType: GameType,
): { teamA: { player1: MatchParticipant; player2: MatchParticipant }; teamB: { player1: MatchParticipant; player2: MatchParticipant } } {
  if (gameType === 'mixed') {
    const males = players.filter(p => getGender(p) === 'M').sort((a, b) => getNtrp(b) - getNtrp(a));
    const females = players.filter(p => getGender(p) === 'F').sort((a, b) => getNtrp(b) - getNtrp(a));

    if (males.length !== 2 || females.length !== 2) {
      // This should never happen if selectPlayersForGame is correct, but guard anyway.
      // Fall through to generic pairing as a safety net.
      console.error('[draw-engine] pairByNtrp called with mixed type but not 2M+2F:', {
        males: males.length,
        females: females.length,
      });
    } else {
      // High M + Low F vs Low M + High F (for NTRP balance)
      return {
        teamA: { player1: males[0], player2: females[1] },
        teamB: { player1: males[1], player2: females[0] },
      };
    }
  }

  // General: sort by NTRP desc, pair 1st+4th vs 2nd+3rd
  const sorted = [...players].sort((a, b) => getNtrp(b) - getNtrp(a));
  return {
    teamA: { player1: sorted[0], player2: sorted[3] },
    teamB: { player1: sorted[1], player2: sorted[2] },
  };
}

// ============================================================
// Main V2 Export
// ============================================================

export function generateDrawV2(input: DrawInputV2): DrawResultV2 {
  const { participants, courts, gamesPerCourt, mode, startTime, timeSlotMinutes } = input;

  const confirmed = participants.filter(p => p.status === 'confirmed');
  if (confirmed.length < 4) {
    throw new Error('경기를 위해 최소 4명의 참가자가 필요합니다');
  }

  let effectiveMode = mode;
  const unknownCount = confirmed.filter(p => getGender(p) === null).length;
  if (mode !== 'free' && unknownCount > confirmed.length * 0.3) effectiveMode = 'free';

  const totalGames = courts.length * gamesPerCourt;
  const totalPlayerSlots = totalGames * 4;
  const totalTimeSlots = gamesPerCourt; // number of time slots = games per court

  const allMales = confirmed.filter(p => getGender(p) === 'M');
  const allFemales = confirmed.filter(p => getGender(p) === 'F');

  // Plan game types upfront
  const gameTypePlan = planGameTypes(totalGames, allMales.length, allFemales.length, effectiveMode);

  // Compute per-player quotas for equal games
  const baseGames = Math.floor(totalPlayerSlots / confirmed.length);
  const extraPlayers = totalPlayerSlots % confirmed.length;

  const shuffledForQuota = shuffle([...confirmed]);
  const quota = new Map<string, number>();
  shuffledForQuota.forEach((p, i) => {
    quota.set(getPlayerId(p), i < extraPlayers ? baseGames + 1 : baseGames);
  });

  // Track per-player state
  const gameCount = new Map<string, number>();
  const gameTypeCounts = new Map<string, { mixed: number; mens: number; womens: number; free: number }>();
  confirmed.forEach(p => {
    gameCount.set(getPlayerId(p), 0);
    gameTypeCounts.set(getPlayerId(p), { mixed: 0, mens: 0, womens: 0, free: 0 });
  });

  // Organize game types into time slots.
  // Each time slot has `courts.length` games running in parallel.
  // The gameTypePlan has `totalGames` entries; assign them to slots.
  const slotGameTypes: GameType[][] = [];
  let planIdx = 0;
  for (let slot = 0; slot < totalTimeSlots; slot++) {
    const slotTypes: GameType[] = [];
    for (let c = 0; c < courts.length && planIdx < totalGames; c++) {
      slotTypes.push(gameTypePlan[planIdx]);
      planIdx++;
    }
    slotGameTypes.push(slotTypes);
  }

  const games: GameSlot[] = [];

  // For each time slot, assign players to courts
  for (let slot = 0; slot < totalTimeSlots; slot++) {
    const slotStart = addMinutes(startTime, slot * timeSlotMinutes);
    const slotEnd = addMinutes(startTime, (slot + 1) * timeSlotMinutes);
    const typesThisSlot = slotGameTypes[slot];
    if (!typesThisSlot || typesThisSlot.length === 0) continue;

    const usedThisSlot = new Set<string>(); // prevent double-booking

    // Sort games in this slot: gendered games first (they are more constrained)
    // mens/womens need 4 of one gender, mixed needs 2+2
    const slotEntries = typesThisSlot.map((gt, courtIdx) => ({ gameType: gt, courtIdx }));
    slotEntries.sort((a, b) => {
      const order = { mens: 0, womens: 0, mixed: 1, free: 2 };
      return (order[a.gameType] ?? 2) - (order[b.gameType] ?? 2);
    });

    for (const { gameType, courtIdx } of slotEntries) {
      const selected = selectPlayersForGame(
        gameType,
        confirmed,
        usedThisSlot,
        gameCount,
        quota,
        gameTypeCounts,
        slot,
      );

      if (!selected) {
        // Cannot fill this game with proper gender composition.
        // Try to fill with fallback: any 4 available players
        const fallbackType = tryFallbackGameType(
          confirmed,
          usedThisSlot,
          gameCount,
          quota,
          effectiveMode,
        );
        if (fallbackType) {
          const fallbackSelected = selectPlayersForGame(
            fallbackType.type,
            confirmed,
            usedThisSlot,
            gameCount,
            quota,
            gameTypeCounts,
            slot,
          );
          if (fallbackSelected) {
            for (const p of fallbackSelected) {
              usedThisSlot.add(getPlayerId(p));
              gameCount.set(getPlayerId(p), (gameCount.get(getPlayerId(p)) || 0) + 1);
              const tc = gameTypeCounts.get(getPlayerId(p))!;
              tc[fallbackType.type]++;
            }
            const { teamA, teamB } = pairByNtrp(fallbackSelected, fallbackType.type);
            games.push({
              timeSlotIndex: slot,
              courtIndex: courtIdx,
              courtName: courts[courtIdx].name,
              gameType: fallbackType.type,
              teamA,
              teamB,
              startTime: slotStart,
              endTime: slotEnd,
            });
            continue;
          }
        }
        // If we truly can't fill this slot, skip (will be caught by validation)
        continue;
      }

      for (const p of selected) {
        usedThisSlot.add(getPlayerId(p));
        gameCount.set(getPlayerId(p), (gameCount.get(getPlayerId(p)) || 0) + 1);
        const tc = gameTypeCounts.get(getPlayerId(p))!;
        tc[gameType]++;
      }

      const { teamA, teamB } = pairByNtrp(selected, gameType);
      games.push({
        timeSlotIndex: slot,
        courtIndex: courtIdx,
        courtName: courts[courtIdx].name,
        gameType,
        teamA,
        teamB,
        startTime: slotStart,
        endTime: slotEnd,
      });
    }
  }

  // === Post-generation repair: ensure game count fairness ===
  // If some games couldn't be filled, we may have fewer than totalGames.
  // Also verify game count balance.
  repairGameCounts(games, confirmed, courts, totalGames, totalTimeSlots, gameCount, quota, gameTypeCounts, startTime, timeSlotMinutes, effectiveMode);

  // === Post-generation balance: swap players to equalize game counts ===
  balanceGameCounts(games, confirmed, effectiveMode);

  // === Validation ===
  validateDraw(games, confirmed, totalGames, effectiveMode);

  // Compute sit-outs per slot
  const sitOutsPerSlot = new Map<number, MatchParticipant[]>();
  for (let slot = 0; slot < totalTimeSlots; slot++) {
    const playingIds = new Set<string>();
    games.filter(g => g.timeSlotIndex === slot).forEach(g => {
      [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2]
        .forEach(p => playingIds.add(getPlayerId(p)));
    });
    const sitting = confirmed.filter(p => !playingIds.has(getPlayerId(p)));
    if (sitting.length > 0) sitOutsPerSlot.set(slot, sitting);
  }

  // Build player summaries
  const summaryMap = new Map<string, PlayerSummary>();
  confirmed.forEach(p => summaryMap.set(getPlayerId(p), { participant: p, totalGames: 0, games: [] }));

  games.forEach((g, idx) => {
    [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2].forEach(p => {
      const s = summaryMap.get(getPlayerId(p));
      if (s) {
        s.totalGames++;
        s.games.push({ timeSlotIndex: g.timeSlotIndex, courtName: g.courtName, gameType: g.gameType, gameOrder: idx + 1 });
      }
    });
  });

  return {
    games,
    playerSummary: Array.from(summaryMap.values()),
    totalTimeSlots,
    sitOuts: Array.from(sitOutsPerSlot.entries()).map(([slot, players]) => ({ timeSlotIndex: slot, players })),
  };
}

/**
 * Select 4 players for a game of the given type.
 * Returns null if not enough eligible players.
 *
 * Gender rules are STRICT:
 *  - mixed: exactly 2M + 2F
 *  - mens: exactly 4M
 *  - womens: exactly 4F
 *  - free: any 4
 */
function selectPlayersForGame(
  gameType: GameType,
  allPlayers: MatchParticipant[],
  usedThisSlot: Set<string>,
  gameCount: Map<string, number>,
  quota: Map<string, number>,
  gameTypeCounts: Map<string, { mixed: number; mens: number; womens: number; free: number }>,
  currentSlot: number,
): MatchParticipant[] | null {
  const available = allPlayers.filter(p => !usedThisSlot.has(getPlayerId(p)));

  // Score players: lower = higher priority
  function playerScore(p: MatchParticipant): number {
    const pid = getPlayerId(p);
    const played = gameCount.get(pid) || 0;
    const playerQuota = quota.get(pid) || 0;
    const remaining = playerQuota - played;
    let score = 0;

    // Primary: players who still have quota remaining get much higher priority
    if (remaining <= 0) {
      score += 10000; // strongly deprioritize over-quota players
    } else {
      score -= remaining * 1000; // more remaining = higher priority
    }

    // Secondary: players with fewer games of THIS type get priority (variety)
    const tc = gameTypeCounts.get(pid);
    if (tc) {
      const typeKey = gameType === 'free' ? 'free' : gameType;
      score += tc[typeKey] * 100;
    }

    // Random tiebreaker for variety on regeneration
    score += Math.random() * 0.5;

    return score;
  }

  if (gameType === 'mixed') {
    const males = available.filter(p => getGender(p) === 'M').sort((a, b) => playerScore(a) - playerScore(b));
    const females = available.filter(p => getGender(p) === 'F').sort((a, b) => playerScore(a) - playerScore(b));
    if (males.length < 2 || females.length < 2) return null;
    return [males[0], males[1], females[0], females[1]];
  }

  if (gameType === 'mens') {
    const males = available.filter(p => getGender(p) === 'M').sort((a, b) => playerScore(a) - playerScore(b));
    if (males.length < 4) return null;
    return males.slice(0, 4);
  }

  if (gameType === 'womens') {
    const females = available.filter(p => getGender(p) === 'F').sort((a, b) => playerScore(a) - playerScore(b));
    if (females.length < 4) return null;
    return females.slice(0, 4);
  }

  // free
  const sorted = available.sort((a, b) => playerScore(a) - playerScore(b));
  if (sorted.length < 4) return null;
  return sorted.slice(0, 4);
}

/**
 * When the planned game type can't be filled, find a fallback type
 * that CAN be filled from the remaining available players.
 */
function tryFallbackGameType(
  allPlayers: MatchParticipant[],
  usedThisSlot: Set<string>,
  gameCount: Map<string, number>,
  quota: Map<string, number>,
  mode: DrawMode,
): { type: GameType } | null {
  const available = allPlayers.filter(p => !usedThisSlot.has(getPlayerId(p)));
  const males = available.filter(p => getGender(p) === 'M');
  const females = available.filter(p => getGender(p) === 'F');

  if (mode === 'free') {
    return available.length >= 4 ? { type: 'free' } : null;
  }

  // Try in order: mixed (most flexible), mens, womens
  if (males.length >= 2 && females.length >= 2) return { type: 'mixed' };
  if (males.length >= 4) return { type: 'mens' };
  if (females.length >= 4) return { type: 'womens' };

  return null;
}

/**
 * Attempt to repair the draw if we have fewer games than totalGames.
 * This can happen when the initial assignment couldn't fill all slots.
 */
function repairGameCounts(
  games: GameSlot[],
  confirmed: MatchParticipant[],
  courts: { name: string }[],
  totalGames: number,
  totalTimeSlots: number,
  gameCount: Map<string, number>,
  quota: Map<string, number>,
  gameTypeCounts: Map<string, { mixed: number; mens: number; womens: number; free: number }>,
  startTime: string,
  timeSlotMinutes: number,
  mode: DrawMode,
): void {
  if (games.length >= totalGames) return;

  // Find empty court slots
  for (let slot = 0; slot < totalTimeSlots && games.length < totalGames; slot++) {
    const gamesInSlot = games.filter(g => g.timeSlotIndex === slot);
    const usedCourts = new Set(gamesInSlot.map(g => g.courtIndex));
    const usedPlayers = new Set<string>();
    gamesInSlot.forEach(g => {
      [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2]
        .forEach(p => usedPlayers.add(getPlayerId(p)));
    });

    for (let courtIdx = 0; courtIdx < courts.length && games.length < totalGames; courtIdx++) {
      if (usedCourts.has(courtIdx)) continue;

      // Try to fill this empty slot
      const fallback = tryFallbackGameType(confirmed, usedPlayers, gameCount, quota, mode);
      if (!fallback) continue;

      const selected = selectPlayersForGame(
        fallback.type,
        confirmed,
        usedPlayers,
        gameCount,
        quota,
        gameTypeCounts,
        slot,
      );
      if (!selected) continue;

      for (const p of selected) {
        usedPlayers.add(getPlayerId(p));
        gameCount.set(getPlayerId(p), (gameCount.get(getPlayerId(p)) || 0) + 1);
        const tc = gameTypeCounts.get(getPlayerId(p))!;
        tc[fallback.type]++;
      }

      const slotStart = addMinutes(startTime, slot * timeSlotMinutes);
      const slotEnd = addMinutes(startTime, (slot + 1) * timeSlotMinutes);
      const { teamA, teamB } = pairByNtrp(selected, fallback.type);
      games.push({
        timeSlotIndex: slot,
        courtIndex: courtIdx,
        courtName: courts[courtIdx].name,
        gameType: fallback.type,
        teamA,
        teamB,
        startTime: slotStart,
        endTime: slotEnd,
      });
    }
  }
}

/**
 * Post-generation balance pass: swap overplayed players with underplayed ones.
 *
 * After the greedy slot-by-slot assignment, some players may have more games
 * than others due to gender constraints limiting choices. This function iterates
 * over games, finds swaps between overplayed and underplayed players that
 * preserve team composition validity and time-slot uniqueness, and applies them.
 *
 * Target: max - min game count <= 1.
 */
function balanceGameCounts(
  games: GameSlot[],
  confirmed: MatchParticipant[],
  mode: DrawMode,
): void {
  const MAX_ITERATIONS = 200; // safety cap

  // Helper: rebuild game count map from scratch
  function buildGameCounts(): Map<string, number> {
    const counts = new Map<string, number>();
    confirmed.forEach(p => counts.set(getPlayerId(p), 0));
    for (const g of games) {
      for (const p of [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2]) {
        counts.set(getPlayerId(p), (counts.get(getPlayerId(p)) || 0) + 1);
      }
    }
    return counts;
  }

  // Helper: get all player IDs in a time slot (excluding a specific game)
  function playersInSlot(slotIndex: number, excludeGame: GameSlot): Set<string> {
    const ids = new Set<string>();
    for (const g of games) {
      if (g === excludeGame) continue;
      if (g.timeSlotIndex !== slotIndex) continue;
      for (const p of [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2]) {
        ids.add(getPlayerId(p));
      }
    }
    return ids;
  }

  // Helper: check if swapping playerOut for playerIn in a game keeps valid composition
  function isValidSwap(
    game: GameSlot,
    playerOut: MatchParticipant,
    playerIn: MatchParticipant,
  ): { valid: boolean; newGameType?: GameType } {
    // Build the 4-player list after swap
    const allPlayers = [game.teamA.player1, game.teamA.player2, game.teamB.player1, game.teamB.player2];
    const outIdx = allPlayers.findIndex(p => getPlayerId(p) === getPlayerId(playerOut));
    if (outIdx === -1) return { valid: false };

    const newPlayers = [...allPlayers];
    newPlayers[outIdx] = playerIn;

    // Check no duplicates
    const ids = new Set(newPlayers.map(p => getPlayerId(p)));
    if (ids.size !== 4) return { valid: false };

    const males = newPlayers.filter(p => getGender(p) === 'M').length;
    const females = newPlayers.filter(p => getGender(p) === 'F').length;

    if (mode === 'free') {
      return { valid: true, newGameType: 'free' };
    }

    // Determine what game type the new composition supports
    if (males === 2 && females === 2) {
      // Can be mixed - also verify each team is 1M+1F after re-pairing
      return { valid: true, newGameType: 'mixed' };
    }
    if (males === 4) {
      if (mode === 'mixed_only') return { valid: false }; // mixed_only doesn't allow mens
      return { valid: true, newGameType: 'mens' };
    }
    if (females === 4) {
      if (mode === 'mixed_only') return { valid: false }; // mixed_only doesn't allow womens
      return { valid: true, newGameType: 'womens' };
    }

    // Invalid composition (e.g., 3M+1F) - not allowed in any gendered mode
    return { valid: false };
  }

  // Helper: apply a swap - replace playerOut with playerIn in the game, re-pair by NTRP
  function applySwap(
    game: GameSlot,
    playerOut: MatchParticipant,
    playerIn: MatchParticipant,
    newGameType: GameType,
  ): void {
    const allPlayers = [game.teamA.player1, game.teamA.player2, game.teamB.player1, game.teamB.player2];
    const outIdx = allPlayers.findIndex(p => getPlayerId(p) === getPlayerId(playerOut));
    allPlayers[outIdx] = playerIn;

    // Re-pair by NTRP for the new game type
    const { teamA, teamB } = pairByNtrp(allPlayers, newGameType);
    game.teamA = teamA;
    game.teamB = teamB;
    game.gameType = newGameType;
  }

  // === Balance game COUNTS: swap overplayed ↔ underplayed ===
  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    const counts = buildGameCounts();
    const values = Array.from(counts.values());
    const minCount = Math.min(...values);
    const maxCount = Math.max(...values);

    if (maxCount - minCount <= 1) break; // balanced!

    const overplayed = confirmed.filter(p => (counts.get(getPlayerId(p)) || 0) === maxCount);
    const underplayed = confirmed.filter(p => (counts.get(getPlayerId(p)) || 0) === minCount);

    let swapped = false;

    for (const overPlayer of overplayed) {
      if (swapped) break;
      const overId = getPlayerId(overPlayer);

      // Shuffle games to try different swaps each iteration
      const shuffledGames = [...games].sort(() => Math.random() - 0.5);

      for (const game of shuffledGames) {
        if (swapped) break;
        const gamePlayers = [game.teamA.player1, game.teamA.player2, game.teamB.player1, game.teamB.player2];
        if (!gamePlayers.some(p => getPlayerId(p) === overId)) continue;

        const slotPlayers = playersInSlot(game.timeSlotIndex, game);

        for (const underPlayer of underplayed) {
          const underId = getPlayerId(underPlayer);
          if (slotPlayers.has(underId)) continue;
          if (gamePlayers.some(p => getPlayerId(p) === underId)) continue;

          const { valid, newGameType } = isValidSwap(game, overPlayer, underPlayer);
          if (!valid || !newGameType) continue;

          applySwap(game, overPlayer, underPlayer, newGameType);
          swapped = true;
          break;
        }
      }
    }

    if (!swapped) break;
  }

  // === Verify final balance ===
  const finalCounts = buildGameCounts();
  const finalValues = Array.from(finalCounts.values());
  const finalMin = Math.min(...finalValues);
  const finalMax = Math.max(...finalValues);
  if (finalMax - finalMin > 1) {
    console.warn(`[DrawEngine] Game count imbalance after balancing: min=${finalMin}, max=${finalMax}`);
  }
}

/**
 * Post-generation validation. Logs warnings for any violations.
 * Throws on critical violations.
 */
function validateDraw(
  games: GameSlot[],
  confirmed: MatchParticipant[],
  totalGames: number,
  mode: DrawMode,
): void {
  const errors: string[] = [];

  // 1. Total game count
  if (games.length !== totalGames) {
    errors.push(`총 경기 수 불일치: expected ${totalGames}, got ${games.length}`);
  }

  // 2. Game type composition (gender validation)
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const players = [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2];
    const ids = players.map(p => getPlayerId(p));

    // 5. No duplicate players in same game
    const uniqueIds = new Set(ids);
    if (uniqueIds.size !== 4) {
      errors.push(`경기 ${i + 1}: 같은 선수가 중복 배정됨`);
    }

    // Gender composition check
    const males = players.filter(p => getGender(p) === 'M').length;
    const females = players.filter(p => getGender(p) === 'F').length;

    if (g.gameType === 'mixed' && (males !== 2 || females !== 2)) {
      errors.push(`경기 ${i + 1}: 혼복인데 ${males}M+${females}F (2M+2F여야 함)`);
    }
    if (g.gameType === 'mens' && males !== 4) {
      errors.push(`경기 ${i + 1}: 남복인데 남자 ${males}명 (4M이어야 함)`);
    }
    if (g.gameType === 'womens' && females !== 4) {
      errors.push(`경기 ${i + 1}: 여복인데 여자 ${females}명 (4F이어야 함)`);
    }

    // For mixed games, verify teams are 1M+1F vs 1M+1F
    if (g.gameType === 'mixed') {
      const teamAMales = [g.teamA.player1, g.teamA.player2].filter(p => getGender(p) === 'M').length;
      const teamBMales = [g.teamB.player1, g.teamB.player2].filter(p => getGender(p) === 'M').length;
      if (teamAMales !== 1 || teamBMales !== 1) {
        errors.push(`경기 ${i + 1}: 혼복 팀 구성 오류 - 팀A ${teamAMales}M, 팀B ${teamBMales}M (각 1M+1F여야 함)`);
      }
    }
  }

  // 3. No double booking (same player in same time slot on different courts)
  const slotMap = new Map<number, string[]>();
  for (const g of games) {
    const players = [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2];
    const ids = players.map(p => getPlayerId(p));
    if (!slotMap.has(g.timeSlotIndex)) slotMap.set(g.timeSlotIndex, []);
    slotMap.get(g.timeSlotIndex)!.push(...ids);
  }
  for (const [slot, ids] of slotMap) {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) {
        errors.push(`시간 슬롯 ${slot}: 선수 ${id}가 같은 시간에 두 코트에 배정됨`);
      }
      seen.add(id);
    }
  }

  // 4. Game count per player (max diff = 1)
  const playerGames = new Map<string, number>();
  confirmed.forEach(p => playerGames.set(getPlayerId(p), 0));
  for (const g of games) {
    [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2].forEach(p => {
      playerGames.set(getPlayerId(p), (playerGames.get(getPlayerId(p)) || 0) + 1);
    });
  }
  const counts = Array.from(playerGames.values());
  const minCount = Math.min(...counts);
  const maxCount = Math.max(...counts);
  if (maxCount - minCount > 1) {
    errors.push(`경기 수 불균형: min=${minCount}, max=${maxCount} (차이는 최대 1이어야 함)`);
  }

  if (errors.length > 0) {
    console.warn('[draw-engine] Validation warnings:', errors);
    // Don't throw for now -- log warnings. The draw is still usable but imperfect.
    // Only throw for truly critical issues (duplicate players).
    const critical = errors.filter(e => e.includes('중복 배정') || e.includes('두 코트에 배정'));
    if (critical.length > 0) {
      throw new Error(`대진표 생성 오류: ${critical.join('; ')}`);
    }
  }
}

// ============================================================
// Legacy V1 Engine (backward compat)
// ============================================================

function serpentinePair(players: MatchParticipant[]): TeamPair[] {
  const sorted = [...players].sort((a, b) => getNtrp(b) - getNtrp(a));
  const teams: TeamPair[] = [];
  const half = Math.floor(sorted.length / 2);
  for (let i = 0; i < half; i++) {
    teams.push({ player1: sorted[i], player2: sorted[sorted.length - 1 - i] });
  }
  return teams;
}

function serpentinePairMixed(males: MatchParticipant[], females: MatchParticipant[]): TeamPair[] {
  const sortedM = [...males].sort((a, b) => getNtrp(b) - getNtrp(a));
  const sortedF = [...females].sort((a, b) => getNtrp(b) - getNtrp(a));
  const teams: TeamPair[] = [];
  const count = Math.min(sortedM.length, sortedF.length);
  for (let i = 0; i < count; i++) {
    teams.push({ player1: sortedM[i], player2: sortedF[sortedF.length - 1 - i] });
  }
  return teams;
}

function generateRoundRobin(teams: TeamPair[]): [TeamPair, TeamPair][] {
  const matchups: [TeamPair, TeamPair][] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchups.push([teams[i], teams[j]]);
    }
  }
  return shuffle(matchups);
}

function assignGamesToCourts(matchups: [TeamPair, TeamPair][], courtCount: number): GeneratedGame[] {
  return matchups.map((matchup, idx) => ({
    court_number: (idx % courtCount) + 1,
    game_order: idx + 1,
    teamA: matchup[0],
    teamB: matchup[1],
  }));
}

function generateTimeSlots(
  games: GeneratedGame[],
  courtCount: number,
  gamesPerCourt: number,
  timeSlotMinutes: number,
  startTimeStr: string,
  courtNames: string[],
): TimeSlot[] {
  const timeSlots: TimeSlot[] = [];
  for (let slotIdx = 0; slotIdx < gamesPerCourt; slotIdx++) {
    const slotStart = addMinutes(startTimeStr, slotIdx * timeSlotMinutes);
    const slotEnd = addMinutes(startTimeStr, (slotIdx + 1) * timeSlotMinutes);
    const courts: TimeSlot['courts'] = [];
    for (let courtIdx = 0; courtIdx < courtCount; courtIdx++) {
      const gameIdx = slotIdx * courtCount + courtIdx;
      courts.push({
        courtIndex: courtIdx,
        courtName: courtNames[courtIdx] || `${courtIdx + 1}코트`,
        game: games[gameIdx] || null,
      });
    }
    timeSlots.push({ gameOrder: slotIdx + 1, startTime: slotStart, endTime: slotEnd, courts });
  }
  return timeSlots;
}

export function generateDrawNew(input: DrawInput): DrawResult {
  const confirmed = input.participants.filter(p => p.status === 'confirmed');
  const {
    courtCount, gamesPerCourt, drawType,
    timeSlotMinutes = 30, startTime = '08:00', courtNames = [],
  } = input;

  let teams: TeamPair[] = [];
  let sitOuts: MatchParticipant[] = [];

  switch (drawType) {
    case 'mixed_doubles': {
      const males = confirmed.filter(p => getGender(p) === 'M');
      const females = confirmed.filter(p => getGender(p) === 'F');
      const noGender = confirmed.filter(p => !getGender(p));
      const pairCount = Math.min(males.length, females.length);
      if (pairCount < 2) throw new Error('혼복을 위해 남녀 각 2명 이상이 필요합니다');
      sitOuts = [...males.slice(pairCount), ...females.slice(pairCount), ...noGender];
      teams = serpentinePairMixed(males.slice(0, pairCount), females.slice(0, pairCount));
      break;
    }
    case 'mens_doubles': {
      const males = confirmed.filter(p => getGender(p) === 'M');
      if (males.length < 4) throw new Error('남복을 위해 최소 4명의 남성 참가자가 필요합니다');
      const usable = males.length % 2 === 0 ? males : males.slice(0, -1);
      if (males.length % 2 !== 0) sitOuts.push(males[males.length - 1]);
      sitOuts.push(...confirmed.filter(p => getGender(p) !== 'M'));
      teams = serpentinePair(usable);
      break;
    }
    case 'womens_doubles': {
      const females = confirmed.filter(p => getGender(p) === 'F');
      if (females.length < 4) throw new Error('여복을 위해 최소 4명의 여성 참가자가 필요합니다');
      const usable = females.length % 2 === 0 ? females : females.slice(0, -1);
      if (females.length % 2 !== 0) sitOuts.push(females[females.length - 1]);
      sitOuts.push(...confirmed.filter(p => getGender(p) !== 'F'));
      teams = serpentinePair(usable);
      break;
    }
    case 'free': {
      if (confirmed.length < 4) throw new Error('복식 경기를 위해 최소 4명의 참가자가 필요합니다');
      const usable = confirmed.length % 2 === 0 ? confirmed : confirmed.slice(0, -1);
      if (confirmed.length % 2 !== 0) sitOuts.push(confirmed[confirmed.length - 1]);
      teams = serpentinePair(usable);
      break;
    }
    default:
      throw new Error(`지원하지 않는 대진 유형입니다: ${drawType}`);
  }

  if (teams.length < 2) throw new Error('경기를 위해 최소 2팀이 필요합니다');

  const matchups = generateRoundRobin(teams);
  const maxGames = gamesPerCourt * courtCount;
  const games = assignGamesToCourts(matchups.slice(0, maxGames), courtCount);
  const timeSlotsList = generateTimeSlots(games, courtCount, gamesPerCourt, timeSlotMinutes, startTime, courtNames);

  return { teams, games, timeSlots: timeSlotsList, sitOuts };
}

// Legacy wrapper
type LegacyDrawInput = {
  participants: MatchParticipant[];
  courtCount: number;
  format: 'doubles' | 'singles' | 'mixed_doubles';
};

type LegacyDrawType = 'random' | 'ntrp_balanced' | 'mixed_gender';

export function generateDraw(input: LegacyDrawInput, drawType: LegacyDrawType): GeneratedGame[] {
  const confirmed = input.participants.filter(p => p.status === 'confirmed');

  if (confirmed.length < 4 && input.format !== 'singles') {
    throw new Error('복식 경기를 위해 최소 4명의 참가자가 필요합니다');
  }
  if (confirmed.length < 2 && input.format === 'singles') {
    throw new Error('최소 2명의 참가자가 필요합니다');
  }

  let newDrawType: DrawType;
  if (input.format === 'mixed_doubles' || drawType === 'mixed_gender') {
    newDrawType = 'mixed_doubles';
  } else {
    newDrawType = 'free';
  }

  if (input.format === 'singles') {
    const teams: TeamPair[] = confirmed.map(p => ({ player1: p, player2: null }));
    const shuffledTeams = shuffle(teams);
    const matchups: [TeamPair, TeamPair][] = [];
    for (let i = 0; i < shuffledTeams.length; i++) {
      for (let j = i + 1; j < shuffledTeams.length; j++) {
        matchups.push([shuffledTeams[i], shuffledTeams[j]]);
      }
    }
    return assignGamesToCourts(shuffle(matchups), input.courtCount);
  }

  const teamCount = Math.floor(confirmed.length / 2);
  const totalGames = (teamCount * (teamCount - 1)) / 2;
  const gamesPerCourt = Math.ceil(totalGames / input.courtCount);

  try {
    return generateDrawNew({
      participants: input.participants,
      courtCount: input.courtCount,
      gamesPerCourt,
      drawType: newDrawType,
    }).games;
  } catch {
    return generateDrawNew({
      participants: input.participants,
      courtCount: input.courtCount,
      gamesPerCourt,
      drawType: 'free',
    }).games;
  }
}
