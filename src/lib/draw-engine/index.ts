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

type PlayerState = {
  participant: MatchParticipant;
  gameCount: number;
  lastPlayedSlot: number; // -1 = hasn't played yet
  consecutiveSlots: number; // how many consecutive slots played ending at lastPlayedSlot
  gameTypes: { mixed: number; mens: number; womens: number; free: number };
};

/**
 * Determine game type distribution for mixed_all mode based on gender ratio.
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
    // Split courts proportionally by gender availability
    // Each mens game needs 4 males, each womens needs 4 females
    const mensCapacity = Math.floor(maleCount / 4);
    const womensCapacity = Math.floor(femaleCount / 4);
    const totalCapacity = mensCapacity + womensCapacity;

    if (totalCapacity === 0) {
      throw new Error('남복 또는 여복을 진행할 수 있는 충분한 참가자가 없습니다');
    }

    const mensRatio = mensCapacity / totalCapacity;
    const mensGames = Math.round(totalGames * mensRatio);
    const womensGames = totalGames - mensGames;

    const types: GameType[] = [];
    // Interleave for even distribution
    let mRemain = mensGames;
    let wRemain = womensGames;
    for (let i = 0; i < totalGames; i++) {
      if (mRemain === 0) { types.push('womens'); wRemain--; continue; }
      if (wRemain === 0) { types.push('mens'); mRemain--; continue; }
      // Pick whichever has higher remaining ratio
      if (mRemain / (mRemain + wRemain) >= 0.5) {
        types.push('mens'); mRemain--;
      } else {
        types.push('womens'); wRemain--;
      }
    }
    return types;
  }

  // mixed_all: distribute 혼복 + 남복 + 여복
  // Mixed games need 2M + 2F per game
  // Mens games need 4M, Womens need 4F
  // Maximize variety while respecting gender availability

  const totalPlayerSlots = totalGames * 4;
  // Each mixed game uses 2M + 2F, mens uses 4M, womens uses 4F
  // We want roughly equal play time per person, so target:
  // mixedGames * 2 + mensGames * 4 <= maleCount * targetGamesPerPerson
  // mixedGames * 2 + womensGames * 4 <= femaleCount * targetGamesPerPerson

  // Simple heuristic: allocate proportionally
  const minGender = Math.min(maleCount, femaleCount);
  const maxGender = Math.max(maleCount, femaleCount);

  // Target: as many mixed games as feasible (most fun), then fill with gendered
  // Each mixed game slot needs 2M + 2F available in that time slot
  // Rough allocation: mixed gets ~40-60% if both genders available
  let mixedGames: number;
  let mensGames: number;
  let womensGames: number;

  if (minGender < 2) {
    // Can't do mixed at all
    mixedGames = 0;
    if (maleCount >= 4) {
      mensGames = femaleCount >= 4 ? Math.round(totalGames * maleCount / (maleCount + femaleCount)) : totalGames;
      womensGames = totalGames - mensGames;
    } else if (femaleCount >= 4) {
      womensGames = totalGames;
      mensGames = 0;
    } else {
      throw new Error('경기를 진행할 수 있는 충분한 참가자가 없습니다');
    }
  } else {
    // Can do mixed. Allocate ~50% mixed, rest gendered based on excess gender
    mixedGames = Math.round(totalGames * 0.4);
    const remaining = totalGames - mixedGames;

    // Excess males/females beyond what mixed needs
    const excessMales = maleCount - minGender; // males beyond matched pairs
    const excessFemales = femaleCount - minGender;

    if (excessMales === 0 && excessFemales === 0) {
      // Equal genders - mostly mixed, maybe a few gendered for variety
      mixedGames = Math.round(totalGames * 0.6);
      mensGames = Math.floor((totalGames - mixedGames) / 2);
      womensGames = totalGames - mixedGames - mensGames;
    } else {
      const totalExcess = excessMales + excessFemales;
      mensGames = totalExcess > 0 ? Math.round(remaining * excessMales / totalExcess) : Math.floor(remaining / 2);
      womensGames = remaining - mensGames;

      // Ensure feasibility: mens needs 4M, womens needs 4F
      if (maleCount < 4) mensGames = 0;
      if (femaleCount < 4) womensGames = 0;
      // Redistribute if a gendered type is impossible
      const unassigned = totalGames - mixedGames - mensGames - womensGames;
      if (unassigned > 0) {
        mixedGames += unassigned;
      }
    }
  }

  // Build interleaved type list
  const types: GameType[] = [];
  let mxR = mixedGames;
  let mnR = mensGames;
  let wmR = womensGames;
  const total = mxR + mnR + wmR;

  for (let i = 0; i < total; i++) {
    // Pick the type with the highest remaining fraction
    const candidates: { type: GameType; remain: number; orig: number }[] = [];
    if (mxR > 0) candidates.push({ type: 'mixed', remain: mxR, orig: mixedGames });
    if (mnR > 0) candidates.push({ type: 'mens', remain: mnR, orig: mensGames });
    if (wmR > 0) candidates.push({ type: 'womens', remain: wmR, orig: womensGames });

    // Sort by highest remaining ratio (remain / orig), break ties by highest remain
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
 * Select 4 players for a game of the given type from the pool,
 * respecting fairness constraints.
 *
 * @param exclude - Player IDs already assigned in this time slot (prevents double-booking)
 */
function selectPlayers(
  gameType: GameType,
  states: Map<string, PlayerState>,
  currentSlot: number,
  targetGames: number,
  males: MatchParticipant[],
  females: MatchParticipant[],
  allPlayers: MatchParticipant[],
  exclude: Set<string>,
): MatchParticipant[] | null {
  // Filter out already-assigned players from pools
  const availMales = males.filter(p => !exclude.has(getPlayerId(p)));
  const availFemales = females.filter(p => !exclude.has(getPlayerId(p)));
  const availAll = allPlayers.filter(p => !exclude.has(getPlayerId(p)));

  // Score each player (lower = more eligible)
  function playerScore(p: MatchParticipant): number {
    const s = states.get(getPlayerId(p))!;
    let score = 0;

    // Primary: fewer games played = much higher priority (lower score)
    score += s.gameCount * 1000;

    // Secondary: fewer games of THIS type = higher priority (variety)
    const typeCount = s.gameTypes[gameType === 'free' ? 'free' : gameType];
    score += typeCount * 100;

    // Soft penalty for consecutive play (avoid but don't block)
    if (s.lastPlayedSlot === currentSlot - 1) {
      score += 30;
      if (s.consecutiveSlots >= 2) {
        score += 50;
      }
    }

    // Tiny random factor to break ties
    score += Math.random() * 5;

    return score;
  }

  if (gameType === 'mixed') {
    const mSorted = [...availMales].sort((a, b) => playerScore(a) - playerScore(b));
    const fSorted = [...availFemales].sort((a, b) => playerScore(a) - playerScore(b));

    if (mSorted.length < 2 || fSorted.length < 2) return null;
    return [mSorted[0], mSorted[1], fSorted[0], fSorted[1]];
  }

  if (gameType === 'mens') {
    const sorted = [...availMales].sort((a, b) => playerScore(a) - playerScore(b));
    if (sorted.length < 4) return null;
    return sorted.slice(0, 4);
  }

  if (gameType === 'womens') {
    const sorted = [...availFemales].sort((a, b) => playerScore(a) - playerScore(b));
    if (sorted.length < 4) return null;
    return sorted.slice(0, 4);
  }

  // free mode
  const sorted = [...availAll].sort((a, b) => playerScore(a) - playerScore(b));
  if (sorted.length < 4) return null;
  return sorted.slice(0, 4);
}

/**
 * Pair 4 players into 2 balanced teams by NTRP.
 * Strategy: highest + lowest vs middle two.
 */
function pairByNtrp(
  players: MatchParticipant[],
  gameType: GameType,
): { teamA: { player1: MatchParticipant; player2: MatchParticipant }; teamB: { player1: MatchParticipant; player2: MatchParticipant } } {
  if (gameType === 'mixed') {
    // For mixed: pair highest M with lowest F, and vice versa
    const males = players.filter(p => getGender(p) === 'M').sort((a, b) => getNtrp(b) - getNtrp(a));
    const females = players.filter(p => getGender(p) === 'F').sort((a, b) => getNtrp(b) - getNtrp(a));

    if (males.length === 2 && females.length === 2) {
      // High M + Low F vs Low M + High F
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
  const {
    participants,
    courts,
    gamesPerCourt,
    mode,
    startTime,
    timeSlotMinutes,
  } = input;

  const confirmed = participants.filter(p => p.status === 'confirmed');
  if (confirmed.length < 4) {
    throw new Error('경기를 위해 최소 4명의 참가자가 필요합니다');
  }

  const males = confirmed.filter(p => getGender(p) === 'M');
  const females = confirmed.filter(p => getGender(p) === 'F');
  const unknownGender = confirmed.filter(p => getGender(p) === null);
  const totalGames = courts.length * gamesPerCourt;

  // If too many unknown genders, fall back to free mode
  let effectiveMode = mode;
  if (mode !== 'free' && unknownGender.length > confirmed.length * 0.3) {
    effectiveMode = 'free';
  }
  const totalTimeSlots = gamesPerCourt; // each time slot has courts.length simultaneous games

  // Validate mode feasibility
  if (effectiveMode === 'mixed_only' && (males.length < 2 || females.length < 2)) {
    throw new Error('혼복을 위해 남녀 각 2명 이상이 필요합니다');
  }
  if (effectiveMode === 'gendered_only') {
    if (males.length < 4 && females.length < 4) {
      throw new Error('남복 또는 여복을 진행하려면 같은 성별 4명 이상이 필요합니다');
    }
  }

  // Target games per person
  const targetGames = Math.round((totalGames * 4) / confirmed.length);

  // Plan game types across all slots
  const gameTypeList = planGameTypes(totalGames, males.length, females.length, effectiveMode);

  // Initialize player states
  const stateMap = new Map<string, PlayerState>();
  for (const p of confirmed) {
    stateMap.set(getPlayerId(p), {
      participant: p,
      gameCount: 0,
      lastPlayedSlot: -1,
      consecutiveSlots: 0,
      gameTypes: { mixed: 0, mens: 0, womens: 0, free: 0 },
    });
  }

  // ── Assign games slot by slot, court by court ──
  // CRITICAL: Track excluded players per slot to prevent double-booking
  const games: GameSlot[] = [];
  const sitOutsPerSlot: Map<number, Set<string>> = new Map();

  let gameIdx = 0;
  for (let slot = 0; slot < totalTimeSlots; slot++) {
    const slotStart = addMinutes(startTime, slot * timeSlotMinutes);
    const slotEnd = addMinutes(startTime, (slot + 1) * timeSlotMinutes);

    // Players already assigned to a court in THIS slot - prevents double-booking
    const assignedThisSlot = new Set<string>();

    for (let courtIdx = 0; courtIdx < courts.length; courtIdx++) {
      if (gameIdx >= totalGames) break;

      const gameType = gameTypeList[gameIdx];

      const selected = selectPlayers(
        gameType,
        stateMap,
        slot,
        targetGames,
        males,
        females,
        confirmed,
        assignedThisSlot,  // CRITICAL: pass exclusion set
      );

      if (!selected) {
        // Can't fill this game - skip
        gameIdx++;
        continue;
      }

      const { teamA, teamB } = pairByNtrp(selected, gameType);

      // Update states for all 4 players and add to exclusion set
      for (const p of selected) {
        const pid = getPlayerId(p);
        const s = stateMap.get(pid)!;
        s.gameCount++;
        if (s.lastPlayedSlot === slot - 1) {
          s.consecutiveSlots++;
        } else {
          s.consecutiveSlots = 1;
        }
        s.lastPlayedSlot = slot;
        const gtKey = gameType === 'free' ? 'free' : gameType;
        s.gameTypes[gtKey]++;
        assignedThisSlot.add(pid);  // Remove from availability for next court
      }

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

      gameIdx++;
    }

    // Compute sit-outs for this slot
    const sittingOut = confirmed.filter(p => !assignedThisSlot.has(getPlayerId(p)));
    if (sittingOut.length > 0) {
      sitOutsPerSlot.set(slot, new Set(sittingOut.map(p => getPlayerId(p))));
    }
  }

  // ── Post-processing: Fairness pass ──
  // HARD CONSTRAINT: max game count difference between any two players is at most 1.
  // base = floor(totalPlayerSlots / totalPlayers), remainder players play base+1.
  // totalPlayerSlots = games.length * 4

  // Rebuild count map from stateMap
  const countMap = new Map<string, number>();
  for (const p of confirmed) {
    countMap.set(getPlayerId(p), stateMap.get(getPlayerId(p))!.gameCount);
  }

  // Helper: check if swapping overPlayer -> underPlayer in a game causes a same-slot conflict
  function wouldCauseSlotConflict(game: GameSlot, underPlayerId: string): boolean {
    // Find all other games in the same time slot
    for (const otherGame of games) {
      if (otherGame === game) continue;
      if (otherGame.timeSlotIndex !== game.timeSlotIndex) continue;
      const otherIds = [
        getPlayerId(otherGame.teamA.player1),
        getPlayerId(otherGame.teamA.player2),
        getPlayerId(otherGame.teamB.player1),
        getPlayerId(otherGame.teamB.player2),
      ];
      if (otherIds.includes(underPlayerId)) return true;
    }
    return false;
  }

  const MAX_SWAP_ITERATIONS = 300;
  for (let iter = 0; iter < MAX_SWAP_ITERATIONS; iter++) {
    // Sort players by game count desc
    const sorted = [...confirmed].sort(
      (a, b) => (countMap.get(getPlayerId(b)) || 0) - (countMap.get(getPlayerId(a)) || 0)
    );
    const maxCount = countMap.get(getPlayerId(sorted[0])) || 0;
    const minCount = countMap.get(getPlayerId(sorted[sorted.length - 1])) || 0;

    if (maxCount - minCount <= 1) break; // Already fair

    // Find an over player (maxCount) and under player (minCount)
    const overPlayerId = getPlayerId(sorted.find(p => (countMap.get(getPlayerId(p)) || 0) === maxCount)!);
    const underPlayerId = getPlayerId(sorted.find(p => (countMap.get(getPlayerId(p)) || 0) === minCount)!);

    if (!overPlayerId || !underPlayerId) break;

    const overParticipant = confirmed.find(p => getPlayerId(p) === overPlayerId)!;
    const underParticipant = confirmed.find(p => getPlayerId(p) === underPlayerId)!;

    // Find a game where overPlayer plays but underPlayer does not, swap is gender-valid,
    // and underPlayer isn't already playing in the same time slot
    let swapped = false;
    for (const game of games) {
      const playerIds = [
        getPlayerId(game.teamA.player1),
        getPlayerId(game.teamA.player2),
        getPlayerId(game.teamB.player1),
        getPlayerId(game.teamB.player2),
      ];

      if (!playerIds.includes(overPlayerId)) continue;
      if (playerIds.includes(underPlayerId)) continue;

      // Check gender compatibility
      const overGender = getGender(overParticipant);
      const underGender = getGender(underParticipant);

      if (game.gameType === 'mixed') {
        if (overGender !== underGender) continue;
      } else if (game.gameType === 'mens') {
        if (underGender !== 'M') continue;
      } else if (game.gameType === 'womens') {
        if (underGender !== 'F') continue;
      }

      // CRITICAL: Check the under player isn't already playing in same time slot
      if (wouldCauseSlotConflict(game, underPlayerId)) continue;

      // Perform the swap
      if (getPlayerId(game.teamA.player1) === overPlayerId) {
        game.teamA.player1 = underParticipant;
      } else if (getPlayerId(game.teamA.player2) === overPlayerId) {
        game.teamA.player2 = underParticipant;
      } else if (getPlayerId(game.teamB.player1) === overPlayerId) {
        game.teamB.player1 = underParticipant;
      } else if (getPlayerId(game.teamB.player2) === overPlayerId) {
        game.teamB.player2 = underParticipant;
      }

      countMap.set(overPlayerId, (countMap.get(overPlayerId) || 0) - 1);
      countMap.set(underPlayerId, (countMap.get(underPlayerId) || 0) + 1);

      const overState = stateMap.get(overPlayerId)!;
      const underState = stateMap.get(underPlayerId)!;
      overState.gameCount--;
      underState.gameCount++;
      overState.gameTypes[game.gameType === 'free' ? 'free' : game.gameType]--;
      underState.gameTypes[game.gameType === 'free' ? 'free' : game.gameType]++;

      swapped = true;
      break;
    }

    if (!swapped) break;
  }

  // ── Post-processing: Game type variety pass (mixed_all mode only) ──
  // If a player played 3+ games and only has one game type category,
  // swap them into the other category.
  if (effectiveMode === 'mixed_all') {
    const MAX_VARIETY_ITERATIONS = 200;
    for (let iter = 0; iter < MAX_VARIETY_ITERATIONS; iter++) {
      let fixedAny = false;

      for (const p of confirmed) {
        const pid = getPlayerId(p);
        const s = stateMap.get(pid)!;
        if (s.gameCount < 3) continue;

        const hasMixed = s.gameTypes.mixed > 0;
        const hasGendered = (s.gameTypes.mens + s.gameTypes.womens) > 0;

        if (hasMixed && hasGendered) continue; // already has variety

        // This player only has one type category. Try to swap them in.
        const pGender = getGender(p);
        if (!hasMixed) {
          // Player needs a mixed game. Find a mixed game where we can swap them in.
          for (const game of games) {
            if (game.gameType !== 'mixed') continue;
            const gamePlayers = [game.teamA.player1, game.teamA.player2, game.teamB.player1, game.teamB.player2];
            const gamePlayerIds = gamePlayers.map(pp => getPlayerId(pp));
            if (gamePlayerIds.includes(pid)) continue;

            // Find a same-gender player in this game who has more variety
            for (let gi = 0; gi < 4; gi++) {
              const candidate = gamePlayers[gi];
              const cid = getPlayerId(candidate);
              if (getGender(candidate) !== pGender) continue;
              const cs = stateMap.get(cid)!;
              if (cs.gameTypes.mixed <= 1) continue; // candidate needs their mixed games too
              if ((countMap.get(cid) || 0) <= (countMap.get(pid) || 0) - 1) continue; // don't break fairness

              // Check slot conflict
              if (wouldCauseSlotConflict(game, pid)) continue;

              // Swap
              if (getPlayerId(game.teamA.player1) === cid) game.teamA.player1 = p;
              else if (getPlayerId(game.teamA.player2) === cid) game.teamA.player2 = p;
              else if (getPlayerId(game.teamB.player1) === cid) game.teamB.player1 = p;
              else if (getPlayerId(game.teamB.player2) === cid) game.teamB.player2 = p;

              // Update states
              s.gameTypes.mixed++;
              const genderedType = pGender === 'M' ? 'mens' : 'womens';
              if (s.gameTypes[genderedType] > 0) s.gameTypes[genderedType]--;
              cs.gameTypes.mixed--;
              if (cs.gameTypes[genderedType] !== undefined) cs.gameTypes[genderedType]++;

              fixedAny = true;
              break;
            }
            if (fixedAny) break;
          }
        } else if (!hasGendered) {
          // Player needs a gendered game. Find a mens/womens game to swap into.
          const targetType: GameType = pGender === 'M' ? 'mens' : pGender === 'F' ? 'womens' : 'mens';
          for (const game of games) {
            if (game.gameType !== targetType) continue;
            const gamePlayers = [game.teamA.player1, game.teamA.player2, game.teamB.player1, game.teamB.player2];
            const gamePlayerIds = gamePlayers.map(pp => getPlayerId(pp));
            if (gamePlayerIds.includes(pid)) continue;

            // Find a player in this game who has variety and can be swapped out
            for (let gi = 0; gi < 4; gi++) {
              const candidate = gamePlayers[gi];
              const cid = getPlayerId(candidate);
              const cs = stateMap.get(cid)!;
              const cGenderedCount = cs.gameTypes[targetType];
              if (cGenderedCount <= 1) continue;
              if ((countMap.get(cid) || 0) <= (countMap.get(pid) || 0) - 1) continue;

              if (wouldCauseSlotConflict(game, pid)) continue;

              // Swap
              if (getPlayerId(game.teamA.player1) === cid) game.teamA.player1 = p;
              else if (getPlayerId(game.teamA.player2) === cid) game.teamA.player2 = p;
              else if (getPlayerId(game.teamB.player1) === cid) game.teamB.player1 = p;
              else if (getPlayerId(game.teamB.player2) === cid) game.teamB.player2 = p;

              s.gameTypes[targetType]++;
              if (s.gameTypes.mixed > 0) s.gameTypes.mixed--;
              cs.gameTypes[targetType]--;
              cs.gameTypes.mixed++;

              fixedAny = true;
              break;
            }
            if (fixedAny) break;
          }
        }
        if (fixedAny) break; // restart outer loop to recheck
      }
      if (!fixedAny) break;
    }
  }

  // ── Recompute sit-outs after post-processing swaps ──
  sitOutsPerSlot.clear();
  for (let slot = 0; slot < totalTimeSlots; slot++) {
    const playingInSlot = new Set<string>();
    for (const game of games) {
      if (game.timeSlotIndex !== slot) continue;
      const players = [game.teamA.player1, game.teamA.player2, game.teamB.player1, game.teamB.player2];
      players.forEach(p => playingInSlot.add(getPlayerId(p)));
    }
    const sittingOut = confirmed.filter(p => !playingInSlot.has(getPlayerId(p)));
    if (sittingOut.length > 0) {
      sitOutsPerSlot.set(slot, new Set(sittingOut.map(p => getPlayerId(p))));
    }
  }

  // Build player summaries
  const summaryMap = new Map<string, PlayerSummary>();
  for (const p of confirmed) {
    summaryMap.set(getPlayerId(p), {
      participant: p,
      totalGames: 0,
      games: [],
    });
  }

  games.forEach((g, idx) => {
    const allInGame = [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2];
    for (const p of allInGame) {
      const summary = summaryMap.get(getPlayerId(p));
      if (summary) {
        summary.totalGames++;
        summary.games.push({
          timeSlotIndex: g.timeSlotIndex,
          courtName: g.courtName,
          gameType: g.gameType,
          gameOrder: idx + 1,
        });
      }
    }
  });

  // Build sit-outs array
  const sitOuts: DrawResultV2['sitOuts'] = [];
  for (let slot = 0; slot < totalTimeSlots; slot++) {
    const sittingOutIds = sitOutsPerSlot.get(slot);
    if (sittingOutIds && sittingOutIds.size > 0) {
      sitOuts.push({
        timeSlotIndex: slot,
        players: confirmed.filter(p => sittingOutIds.has(getPlayerId(p))),
      });
    }
  }

  return {
    games,
    playerSummary: Array.from(summaryMap.values()),
    totalTimeSlots,
    sitOuts,
  };
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
