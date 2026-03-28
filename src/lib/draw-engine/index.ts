import type { MatchParticipant } from '@/types';

// ============================================================
// Types
// ============================================================

export type DrawType = 'mixed_doubles' | 'mens_doubles' | 'womens_doubles' | 'free';

export type TeamPair = {
  player1: MatchParticipant;
  player2: MatchParticipant | null;
};

export type GeneratedGame = {
  court_number: number;
  game_order: number; // global game order across all courts
  teamA: TeamPair;
  teamB: TeamPair;
};

export type TimeSlot = {
  gameOrder: number; // 1, 2, 3...
  startTime: string; // "08:00"
  endTime: string;   // "08:30"
  courts: { courtIndex: number; courtName: string; game: GeneratedGame | null }[];
};

export type DrawResult = {
  teams: TeamPair[];
  games: GeneratedGame[];
  timeSlots: TimeSlot[];
  sitOuts: MatchParticipant[]; // players sitting out this draw
};

export type DrawInput = {
  participants: MatchParticipant[];
  courtCount: number;
  gamesPerCourt: number; // how many games per court (for timetable)
  drawType: DrawType;
  timeSlotMinutes?: number; // default 30
  startTime?: string; // e.g. "08:00"
  courtNames?: string[]; // custom court names, e.g. ["A코트", "B코트"]
};

// ============================================================
// Legacy compat types (kept for backward compatibility with API)
// ============================================================

type LegacyDrawInput = {
  participants: MatchParticipant[];
  courtCount: number;
  format: 'doubles' | 'singles' | 'mixed_doubles';
};

type LegacyDrawType = 'random' | 'ntrp_balanced' | 'mixed_gender';

// ============================================================
// Helpers
// ============================================================

function getNtrp(p: MatchParticipant): number {
  return p.ntrp_override || p.profiles?.ntrp_level || 3.0;
}

function getGender(p: MatchParticipant): 'M' | 'F' | null {
  return (p.profiles?.gender as 'M' | 'F' | null) || (p as any).guest_gender || null;
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Serpentine pairing: sort desc by NTRP, pair 1st with last, 2nd with 2nd-to-last, etc.
 * This creates NTRP-balanced teams.
 */
function serpentinePair(players: MatchParticipant[]): TeamPair[] {
  const sorted = [...players].sort((a, b) => getNtrp(b) - getNtrp(a));
  const teams: TeamPair[] = [];
  const half = Math.floor(sorted.length / 2);

  for (let i = 0; i < half; i++) {
    teams.push({
      player1: sorted[i],
      player2: sorted[sorted.length - 1 - i],
    });
  }

  return teams;
}

/**
 * Mixed doubles serpentine: highest M with lowest F by NTRP
 */
function serpentinePairMixed(males: MatchParticipant[], females: MatchParticipant[]): TeamPair[] {
  const sortedM = [...males].sort((a, b) => getNtrp(b) - getNtrp(a));
  const sortedF = [...females].sort((a, b) => getNtrp(b) - getNtrp(a));
  const teams: TeamPair[] = [];
  const count = Math.min(sortedM.length, sortedF.length);

  // Highest M with lowest F (serpentine cross-gender)
  for (let i = 0; i < count; i++) {
    teams.push({
      player1: sortedM[i],
      player2: sortedF[sortedF.length - 1 - i],
    });
  }

  return teams;
}

/**
 * Generate round-robin matchups between teams
 */
function generateRoundRobin(teams: TeamPair[]): [TeamPair, TeamPair][] {
  const matchups: [TeamPair, TeamPair][] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchups.push([teams[i], teams[j]]);
    }
  }
  return shuffle(matchups);
}

/**
 * Assign matchups to courts with game ordering
 * Games fill courts left-to-right, top-to-bottom (game order -> courts)
 */
function assignGamesToCourts(
  matchups: [TeamPair, TeamPair][],
  courtCount: number,
): GeneratedGame[] {
  const games: GeneratedGame[] = [];

  matchups.forEach((matchup, idx) => {
    const courtIdx = idx % courtCount;
    const gameOrder = idx + 1; // global sequential order

    games.push({
      court_number: courtIdx + 1,
      game_order: gameOrder,
      teamA: matchup[0],
      teamB: matchup[1],
    });
  });

  return games;
}

/**
 * Add time to "HH:MM" string
 */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const totalMin = h * 60 + m + minutes;
  const newH = Math.floor(totalMin / 60) % 24;
  const newM = totalMin % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

/**
 * Generate timetable from games
 */
function generateTimeSlots(
  games: GeneratedGame[],
  courtCount: number,
  gamesPerCourt: number,
  timeSlotMinutes: number,
  startTime: string,
  courtNames: string[],
): TimeSlot[] {
  const totalSlots = gamesPerCourt; // each slot = one round of games across all courts
  const timeSlots: TimeSlot[] = [];

  for (let slotIdx = 0; slotIdx < totalSlots; slotIdx++) {
    const slotStart = addMinutes(startTime, slotIdx * timeSlotMinutes);
    const slotEnd = addMinutes(startTime, (slotIdx + 1) * timeSlotMinutes);

    const courts: TimeSlot['courts'] = [];
    for (let courtIdx = 0; courtIdx < courtCount; courtIdx++) {
      // Find the game for this court in this time slot
      // Games are ordered globally. For time slot N, court C:
      // the game index is slotIdx * courtCount + courtIdx
      const gameIdx = slotIdx * courtCount + courtIdx;
      const game = games[gameIdx] || null;

      courts.push({
        courtIndex: courtIdx,
        courtName: courtNames[courtIdx] || `${courtIdx + 1}코트`,
        game,
      });
    }

    timeSlots.push({
      gameOrder: slotIdx + 1,
      startTime: slotStart,
      endTime: slotEnd,
      courts,
    });
  }

  return timeSlots;
}

// ============================================================
// Main Draw Generation (New API)
// ============================================================

export function generateDrawNew(input: DrawInput): DrawResult {
  const confirmed = input.participants.filter((p) => p.status === 'confirmed');
  const {
    courtCount,
    gamesPerCourt,
    drawType,
    timeSlotMinutes = 30,
    startTime = '08:00',
    courtNames = [],
  } = input;

  let teams: TeamPair[] = [];
  let sitOuts: MatchParticipant[] = [];

  switch (drawType) {
    case 'mixed_doubles': {
      const males = confirmed.filter((p) => getGender(p) === 'M');
      const females = confirmed.filter((p) => getGender(p) === 'F');
      const noGender = confirmed.filter((p) => !getGender(p));

      // Sit outs: uneven genders + no-gender participants
      const pairCount = Math.min(males.length, females.length);
      if (pairCount < 2) {
        throw new Error('혼복을 위해 남녀 각 2명 이상이 필요합니다');
      }

      const usedMales = males.slice(0, pairCount);
      const usedFemales = females.slice(0, pairCount);
      const remainingMales = males.slice(pairCount);
      const remainingFemales = females.slice(pairCount);

      sitOuts = [...remainingMales, ...remainingFemales, ...noGender];
      teams = serpentinePairMixed(usedMales, usedFemales);
      break;
    }

    case 'mens_doubles': {
      const males = confirmed.filter((p) => getGender(p) === 'M');
      const nonMales = confirmed.filter((p) => getGender(p) !== 'M');

      if (males.length < 4) {
        throw new Error('남복을 위해 최소 4명의 남성 참가자가 필요합니다');
      }

      // If odd number, last one sits out
      const usable = males.length % 2 === 0 ? males : males.slice(0, -1);
      if (males.length % 2 !== 0) {
        sitOuts.push(males[males.length - 1]);
      }
      sitOuts.push(...nonMales);

      teams = serpentinePair(usable);
      break;
    }

    case 'womens_doubles': {
      const females = confirmed.filter((p) => getGender(p) === 'F');
      const nonFemales = confirmed.filter((p) => getGender(p) !== 'F');

      if (females.length < 4) {
        throw new Error('여복을 위해 최소 4명의 여성 참가자가 필요합니다');
      }

      const usable = females.length % 2 === 0 ? females : females.slice(0, -1);
      if (females.length % 2 !== 0) {
        sitOuts.push(females[females.length - 1]);
      }
      sitOuts.push(...nonFemales);

      teams = serpentinePair(usable);
      break;
    }

    case 'free': {
      if (confirmed.length < 4) {
        throw new Error('복식 경기를 위해 최소 4명의 참가자가 필요합니다');
      }

      const usable = confirmed.length % 2 === 0 ? confirmed : confirmed.slice(0, -1);
      if (confirmed.length % 2 !== 0) {
        sitOuts.push(confirmed[confirmed.length - 1]);
      }

      teams = serpentinePair(usable);
      break;
    }

    default:
      throw new Error(`지원하지 않는 대진 유형입니다: ${drawType}`);
  }

  if (teams.length < 2) {
    throw new Error('경기를 위해 최소 2팀이 필요합니다');
  }

  // Generate round-robin matchups
  const matchups = generateRoundRobin(teams);

  // Limit to available game slots if gamesPerCourt is specified
  const maxGames = gamesPerCourt * courtCount;
  const limitedMatchups = matchups.slice(0, maxGames);

  // Assign to courts
  const games = assignGamesToCourts(limitedMatchups, courtCount);

  // Generate timetable
  const timeSlots = generateTimeSlots(
    games,
    courtCount,
    gamesPerCourt,
    timeSlotMinutes,
    startTime,
    courtNames,
  );

  return { teams, games, timeSlots, sitOuts };
}

// ============================================================
// Legacy API (backward compatibility)
// ============================================================

/**
 * Legacy draw generation function - maps old API to new engine
 */
export function generateDraw(
  input: LegacyDrawInput,
  drawType: LegacyDrawType,
): GeneratedGame[] {
  const confirmed = input.participants.filter((p) => p.status === 'confirmed');

  if (confirmed.length < 4 && input.format !== 'singles') {
    throw new Error('복식 경기를 위해 최소 4명의 참가자가 필요합니다');
  }

  if (confirmed.length < 2 && input.format === 'singles') {
    throw new Error('최소 2명의 참가자가 필요합니다');
  }

  // Map legacy format + drawType to new DrawType
  let newDrawType: DrawType;

  if (input.format === 'mixed_doubles' || drawType === 'mixed_gender') {
    newDrawType = 'mixed_doubles';
  } else if (drawType === 'ntrp_balanced') {
    newDrawType = 'free'; // NTRP balanced without gender constraint
  } else {
    newDrawType = 'free'; // random also uses free (serpentine gives balance)
  }

  // For singles, use the old simple approach
  if (input.format === 'singles') {
    const teams: TeamPair[] = confirmed.map((p) => ({ player1: p, player2: null }));
    const shuffledTeams = shuffle(teams);
    const matchups: [TeamPair, TeamPair][] = [];
    for (let i = 0; i < shuffledTeams.length; i++) {
      for (let j = i + 1; j < shuffledTeams.length; j++) {
        matchups.push([shuffledTeams[i], shuffledTeams[j]]);
      }
    }
    return assignGamesToCourts(shuffle(matchups), input.courtCount);
  }

  // Estimate gamesPerCourt from round-robin
  const teamCount = Math.floor(confirmed.length / 2);
  const totalGames = (teamCount * (teamCount - 1)) / 2;
  const gamesPerCourt = Math.ceil(totalGames / input.courtCount);

  try {
    const result = generateDrawNew({
      participants: input.participants,
      courtCount: input.courtCount,
      gamesPerCourt,
      drawType: newDrawType,
    });
    return result.games;
  } catch {
    // Fallback: if new engine fails (e.g. gender constraints not met), use free
    const result = generateDrawNew({
      participants: input.participants,
      courtCount: input.courtCount,
      gamesPerCourt,
      drawType: 'free',
    });
    return result.games;
  }
}
