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
  const { participants, courts, gamesPerCourt, mode, startTime, timeSlotMinutes } = input;

  const confirmed = participants.filter(p => p.status === 'confirmed');
  if (confirmed.length < 4) {
    throw new Error('경기를 위해 최소 4명의 참가자가 필요합니다');
  }

  let effectiveMode = mode;
  const unknownCount = confirmed.filter(p => getGender(p) === null).length;
  if (mode !== 'free' && unknownCount > confirmed.length * 0.3) effectiveMode = 'free';

  const totalGames = courts.length * gamesPerCourt;
  const totalSlots = totalGames * 4; // total player-slots
  const baseGames = Math.floor(totalSlots / confirmed.length);
  const extraPlayers = totalSlots % confirmed.length;
  const totalTimeSlots = gamesPerCourt;

  // Each player plays exactly baseGames or baseGames+1 games
  // Assign quota: first `extraPlayers` (shuffled) get baseGames+1, rest get baseGames
  const shuffledPlayers = shuffle([...confirmed]);
  const quota = new Map<string, number>();
  shuffledPlayers.forEach((p, i) => {
    quota.set(getPlayerId(p), i < extraPlayers ? baseGames + 1 : baseGames);
  });

  // Track game count per player
  const gameCount = new Map<string, number>();
  confirmed.forEach(p => gameCount.set(getPlayerId(p), 0));

  const games: GameSlot[] = [];

  for (let slot = 0; slot < totalTimeSlots; slot++) {
    const slotStart = addMinutes(startTime, slot * timeSlotMinutes);
    const slotEnd = addMinutes(startTime, (slot + 1) * timeSlotMinutes);

    // How many players needed this slot: courts.length * 4
    const needed = Math.min(courts.length, totalGames - games.length) * 4;
    if (needed <= 0) break;

    // Pick players for this slot: those with most remaining quota first
    const available = confirmed
      .filter(p => {
        const pid = getPlayerId(p);
        return (gameCount.get(pid) || 0) < (quota.get(pid) || 0);
      })
      .sort((a, b) => {
        const aRemain = (quota.get(getPlayerId(a)) || 0) - (gameCount.get(getPlayerId(a)) || 0);
        const bRemain = (quota.get(getPlayerId(b)) || 0) - (gameCount.get(getPlayerId(b)) || 0);
        if (bRemain !== aRemain) return bRemain - aRemain; // more remaining = higher priority
        return Math.random() - 0.5; // random tiebreaker
      });

    // If not enough players with quota, add players with least games
    let slotPlayers = available.slice(0, needed);
    if (slotPlayers.length < needed) {
      const alreadyIds = new Set(slotPlayers.map(p => getPlayerId(p)));
      const extras = confirmed
        .filter(p => !alreadyIds.has(getPlayerId(p)))
        .sort((a, b) => (gameCount.get(getPlayerId(a)) || 0) - (gameCount.get(getPlayerId(b)) || 0));
      slotPlayers = [...slotPlayers, ...extras.slice(0, needed - slotPlayers.length)];
    }

    // Split into court groups of 4
    const courtsThisSlot = Math.min(courts.length, Math.floor(slotPlayers.length / 4));
    for (let courtIdx = 0; courtIdx < courtsThisSlot; courtIdx++) {
      if (games.length >= totalGames) break;
      const group = slotPlayers.slice(courtIdx * 4, courtIdx * 4 + 4);
      if (group.length < 4) break;

      // Determine game type based on gender of the 4 players and mode
      const gameType = determineGameType(group, effectiveMode);

      // Pair by NTRP
      const { teamA, teamB } = pairByNtrp(group, gameType);

      for (const p of group) {
        gameCount.set(getPlayerId(p), (gameCount.get(getPlayerId(p)) || 0) + 1);
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
    }
  }

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

/** Determine game type based on actual player genders */
function determineGameType(players: MatchParticipant[], mode: DrawMode): GameType {
  if (mode === 'free') return 'free';

  const males = players.filter(p => getGender(p) === 'M');
  const females = players.filter(p => getGender(p) === 'F');

  if (mode === 'mixed_only') return 'mixed';
  if (mode === 'gendered_only') {
    return males.length >= females.length ? 'mens' : 'womens';
  }

  // mixed_all: determine by composition
  if (males.length === 2 && females.length === 2) return 'mixed';
  if (males.length >= 3) return 'mens';
  if (females.length >= 3) return 'womens';
  return 'mixed'; // 2+2 default
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
