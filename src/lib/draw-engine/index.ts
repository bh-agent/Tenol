import type { MatchParticipant } from '@/types';

export type TeamPair = {
  player1: MatchParticipant;
  player2: MatchParticipant | null; // null for singles
};

export type GeneratedGame = {
  court_number: number;
  game_order: number;
  teamA: TeamPair;
  teamB: TeamPair;
};

type DrawInput = {
  participants: MatchParticipant[];
  courtCount: number;
  format: 'doubles' | 'singles' | 'mixed_doubles';
};

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getNtrp(p: MatchParticipant): number {
  return p.ntrp_override || p.profiles?.ntrp_level || 3.0;
}

/**
 * Pair players into doubles teams using serpentine method for NTRP balance
 * Sorts by NTRP desc, pairs 1st with last, 2nd with 2nd-to-last, etc.
 */
function pairByNtrp(participants: MatchParticipant[]): TeamPair[] {
  const sorted = [...participants].sort((a, b) => getNtrp(b) - getNtrp(a));
  const teams: TeamPair[] = [];
  const half = Math.ceil(sorted.length / 2);

  for (let i = 0; i < half; i++) {
    const partner = sorted[sorted.length - 1 - i];
    if (partner && partner.id !== sorted[i].id) {
      teams.push({ player1: sorted[i], player2: partner });
    }
  }

  return teams;
}

/**
 * Pair players randomly
 */
function pairRandom(participants: MatchParticipant[]): TeamPair[] {
  const shuffled = shuffle(participants);
  const teams: TeamPair[] = [];

  for (let i = 0; i < shuffled.length - 1; i += 2) {
    teams.push({ player1: shuffled[i], player2: shuffled[i + 1] });
  }

  return teams;
}

/**
 * Pair by mixed gender (1M + 1F per team), then balance by NTRP
 */
function pairMixedGender(participants: MatchParticipant[]): TeamPair[] {
  const males = participants.filter((p) => p.profiles?.gender === 'M');
  const females = participants.filter((p) => p.profiles?.gender === 'F');
  const others = participants.filter((p) => !p.profiles?.gender);

  // Sort each group by NTRP
  males.sort((a, b) => getNtrp(b) - getNtrp(a));
  females.sort((a, b) => getNtrp(b) - getNtrp(a));

  const teams: TeamPair[] = [];
  const minPairs = Math.min(males.length, females.length);

  // Pair M+F using serpentine
  for (let i = 0; i < minPairs; i++) {
    const femaleIdx = females.length - 1 - i;
    if (femaleIdx >= 0 && femaleIdx < females.length) {
      teams.push({ player1: males[i], player2: females[femaleIdx] });
    }
  }

  // Handle remaining players
  const remaining = [
    ...males.slice(minPairs),
    ...females.slice(0, Math.max(0, females.length - minPairs)),
    ...others,
  ];

  for (let i = 0; i < remaining.length - 1; i += 2) {
    teams.push({ player1: remaining[i], player2: remaining[i + 1] });
  }

  return teams;
}

/**
 * Generate matchups between teams and assign to courts
 */
function assignGames(teams: TeamPair[], courtCount: number): GeneratedGame[] {
  const games: GeneratedGame[] = [];

  if (teams.length < 2) return games;

  // Round-robin: every team plays every other team
  const matchups: [TeamPair, TeamPair][] = [];
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      matchups.push([teams[i], teams[j]]);
    }
  }

  // Shuffle matchups for fairness
  const shuffledMatchups = shuffle(matchups);

  // Assign to courts, distributing evenly
  const courtQueues: GeneratedGame[][] = Array.from({ length: courtCount }, () => []);

  shuffledMatchups.forEach((matchup, idx) => {
    const courtIdx = idx % courtCount;
    const gameOrder = courtQueues[courtIdx].length + 1;

    const game: GeneratedGame = {
      court_number: courtIdx + 1,
      game_order: gameOrder,
      teamA: matchup[0],
      teamB: matchup[1],
    };

    courtQueues[courtIdx].push(game);
    games.push(game);
  });

  return games;
}

/**
 * Main draw generation function
 */
export function generateDraw(
  input: DrawInput,
  drawType: 'random' | 'ntrp_balanced' | 'mixed_gender'
): GeneratedGame[] {
  const confirmed = input.participants.filter((p) => p.status === 'confirmed');

  if (confirmed.length < 4 && input.format !== 'singles') {
    throw new Error('복식 경기를 위해 최소 4명의 참가자가 필요합니다');
  }

  if (confirmed.length < 2 && input.format === 'singles') {
    throw new Error('최소 2명의 참가자가 필요합니다');
  }

  let teams: TeamPair[];

  if (input.format === 'singles') {
    // For singles, each "team" is one player
    teams = confirmed.map((p) => ({ player1: p, player2: null }));
    if (drawType === 'ntrp_balanced') {
      teams.sort((a, b) => getNtrp(b.player1) - getNtrp(a.player1));
    } else {
      teams = shuffle(teams);
    }
  } else {
    switch (drawType) {
      case 'ntrp_balanced':
        teams = pairByNtrp(confirmed);
        break;
      case 'mixed_gender':
        teams = pairMixedGender(confirmed);
        break;
      case 'random':
      default:
        teams = pairRandom(confirmed);
        break;
    }
  }

  return assignGames(teams, input.courtCount);
}
