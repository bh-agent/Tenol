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
  seed?: number; // optional: deterministic generation (tests). Omit for random.
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

/** Seeded PRNG (mulberry32) so generation is reproducible and testable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function shuffleWith<T>(array: T[], rng: () => number): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
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
// V2 Engine: Core Algorithm (fair-by-construction)
// ============================================================
//
// Fairness is GUARANTEED at construction time via the "lift-smallest-k"
// invariant, not fixed up afterwards:
//   Keep a per-player game counter within each pool. Each time slot, fill that
//   pool's seat demand k by taking the k players with the SMALLEST counters and
//   incrementing exactly those. Then max-min <= 1 within the pool at all times,
//   provided k <= poolSize every slot.
// Male and female pools are independent (a person belongs to exactly one), so
// cross-gender balance is decided solely by the game-type allocation (Stage 1),
// which is chosen to match each pool's seat demand to its headcount.

type GameTypeCounts = { mens: number; womens: number; mixed: number; free: number };

type Allocation = {
  slotGames: number; // games per time slot (<= courts)
  gEff: number; // total realizable games = slotGames * T
  counts: GameTypeCounts; // total games of each type
  structuralMinSpread: number; // best achievable max-min game count across all players
  poolMode: 'single' | 'gendered'; // free => single pool of whole roster
};

/** Per-player target counts distributing `seats` among `n` players; spread <= 1. */
function distributeEven(seats: number, n: number): number[] {
  if (n <= 0) return [];
  const q = Math.floor(seats / n);
  const r = seats % n;
  return Array.from({ length: n }, (_, i) => (i < r ? q + 1 : q));
}

/** Combined min/max spread of per-player counts across several pools. */
function combinedSpread(pools: { seats: number; n: number }[]): number {
  const vals: number[] = [];
  for (const { seats, n } of pools) {
    if (n <= 0) continue;
    const q = Math.floor(seats / n);
    const r = seats % n;
    vals.push(q);
    if (r > 0) vals.push(q + 1);
  }
  if (vals.length === 0) return 0;
  return Math.max(...vals) - Math.min(...vals);
}

/**
 * Stage 1 — capacity + game-type allocation (EVENT-TOTAL model).
 *
 * `slotGames` = the most games one time slot can feasibly host (fills courts).
 * The event therefore has Gcap = slotGames * T game-slots to fill. Instead of
 * fixing ONE per-slot composition and repeating it (which strands a single court
 * on a single gender), we choose the TOTAL count of each game type across the
 * whole event so per-player counts come out as even as possible, then require
 * those totals to be packable into T feasible slots. Letting the composition
 * vary slot-to-slot is exactly what lets one court alternate 남복/여복.
 *
 * M/F = male/female headcount, nTotal = confirmed count (free only). C courts,
 * T time slots.
 */
function computeAllocation(
  mode: DrawMode,
  M: number,
  F: number,
  nTotal: number,
  C: number,
  T: number,
): Allocation {
  if (mode === 'free') {
    const slotGames = Math.min(C, Math.floor(nTotal / 4));
    const gEff = slotGames * T;
    return {
      slotGames,
      gEff,
      counts: { mens: 0, womens: 0, mixed: 0, free: gEff },
      structuralMinSpread: combinedSpread([{ seats: 4 * gEff, n: nTotal }]),
      poolMode: 'single',
    };
  }

  const allowMens = mode === 'gendered_only' || mode === 'mixed_all';
  const allowWomens = mode === 'gendered_only' || mode === 'mixed_all';
  const allowMixed = mode === 'mixed_only' || mode === 'mixed_all';

  // Slot capacity: the most games a single slot can feasibly host.
  const maxA = allowMens ? Math.floor(M / 4) : 0;
  const maxB = allowWomens ? Math.floor(F / 4) : 0;
  const maxC = allowMixed ? Math.min(Math.floor(M / 2), Math.floor(F / 2)) : 0;
  let slotGames = 0;
  for (let a = 0; a <= maxA; a++) {
    for (let b = 0; b <= maxB; b++) {
      for (let c = 0; c <= maxC; c++) {
        const g = a + b + c;
        if (g === 0 || g > C) continue;
        if (4 * a + 2 * c > M) continue;
        if (4 * b + 2 * c > F) continue;
        if (g > slotGames) slotGames = g;
      }
    }
  }
  if (slotGames === 0) {
    if (mode === 'mixed_only') throw new Error('혼복을 진행하려면 남성과 여성이 각각 2명 이상 필요합니다');
    if (mode === 'gendered_only') throw new Error('남복 또는 여복을 진행할 수 있는 충분한 참가자가 없습니다');
    throw new Error('경기를 진행할 수 있는 충분한 참가자가 없습니다');
  }

  const Gcap = slotGames * T;
  const capMens = allowMens && M >= 4 ? Gcap : 0;
  const capWomens = allowWomens && F >= 4 ? Gcap : 0;
  const capMixed = allowMixed && M >= 2 && F >= 2 ? Gcap : 0;

  // Choose event-total type counts (A mens, B womens, Cx mixed) that fill Gcap
  // and MINIMIZE cross-pool game-count spread, preferring packable ones.
  type Cand = { mens: number; womens: number; mixed: number; spread: number; pref: number };
  const cands: Cand[] = [];
  for (let A = 0; A <= capMens; A++) {
    for (let B = 0; A + B <= Gcap && B <= capWomens; B++) {
      const Cx = Gcap - A - B;
      if (Cx < 0 || Cx > capMixed) continue;
      const maleSeats = 4 * A + 2 * Cx;
      const femaleSeats = 4 * B + 2 * Cx;
      const spread = combinedSpread([
        { seats: maleSeats, n: M },
        { seats: femaleSeats, n: F },
      ]);
      // Secondary (never overrides fairness): mixed_all favors more 혼복 games.
      const pref = mode === 'mixed_all' ? Gcap - Cx : 0;
      cands.push({ mens: A, womens: B, mixed: Cx, spread, pref });
    }
  }
  if (cands.length === 0) {
    throw new Error('선택한 모드로 진행할 수 있는 경기가 없습니다. 참가자 구성이나 모드를 확인해주세요.');
  }
  cands.sort((x, y) => x.spread - y.spread || x.pref - y.pref);

  // Pick the lowest-spread allocation that actually packs into T feasible slots.
  let chosen: Cand | undefined;
  for (const cand of cands) {
    if (slotGames === 1) { chosen = cand; break; } // one game per slot always packs
    const counts: GameTypeCounts = { mens: cand.mens, womens: cand.womens, mixed: cand.mixed, free: 0 };
    if (canPackTotals(counts, slotGames, T, M, F)) { chosen = cand; break; }
  }
  if (!chosen) chosen = cands[0];

  return {
    slotGames,
    gEff: Gcap,
    counts: { mens: chosen.mens, womens: chosen.womens, mixed: chosen.mixed, free: 0 },
    structuralMinSpread: chosen.spread,
    poolMode: 'gendered',
  };
}

/**
 * Exported so tests assert against the SAME fairness oracle the engine enforces.
 * Returns the best achievable max-min game count for this roster/mode/capacity.
 */
export function structuralMinSpread(
  mode: DrawMode,
  participants: MatchParticipant[],
  courts: number,
  gamesPerCourt: number,
): number {
  const confirmed = participants.filter((p) => p.status === 'confirmed');
  const M = confirmed.filter((p) => getGender(p) === 'M').length;
  const F = confirmed.filter((p) => getGender(p) === 'F').length;
  const alloc = computeAllocation(mode, M, F, confirmed.length, courts, gamesPerCourt);
  return alloc.structuralMinSpread;
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
    const males = players.filter((p) => getGender(p) === 'M').sort((a, b) => getNtrp(b) - getNtrp(a));
    const females = players.filter((p) => getGender(p) === 'F').sort((a, b) => getNtrp(b) - getNtrp(a));

    if (males.length === 2 && females.length === 2) {
      // High M + Low F vs Low M + High F (for NTRP balance)
      return {
        teamA: { player1: males[0], player2: females[1] },
        teamB: { player1: males[1], player2: females[0] },
      };
    }
    // Safety net (should not happen with correct seat assignment)
    console.error('[draw-engine] pairByNtrp mixed but not 2M+2F:', {
      males: males.length,
      females: females.length,
    });
  }

  const sorted = [...players].sort((a, b) => getNtrp(b) - getNtrp(a));
  return {
    teamA: { player1: sorted[0], player2: sorted[3] },
    teamB: { player1: sorted[1], player2: sorted[2] },
  };
}

/** Pick the k players with the smallest game counts (the fairness core). */
function pickLowestK(
  pool: MatchParticipant[],
  k: number,
  gameCount: Map<string, number>,
  lastSlot: Map<string, number>,
  rng: () => number,
): MatchParticipant[] {
  if (k <= 0) return [];
  const sorted = [...pool].sort((a, b) => {
    const ca = gameCount.get(getPlayerId(a)) ?? 0;
    const cb = gameCount.get(getPlayerId(b)) ?? 0;
    if (ca !== cb) return ca - cb; // fewest games first — the invariant
    // Tie-break (never harms fairness, only quality):
    const la = lastSlot.get(getPlayerId(a)) ?? -1;
    const lb = lastSlot.get(getPlayerId(b)) ?? -1;
    if (la !== lb) return la - lb; // played longest ago first (time-spread)
    return rng() - 0.5; // seed randomness
  });
  return sorted.slice(0, k);
}

const seatsM = (t: GameType): number => (t === 'mens' ? 4 : t === 'mixed' ? 2 : 0);
const seatsF = (t: GameType): number => (t === 'womens' ? 4 : t === 'mixed' ? 2 : 0);

/** Feasible per-slot compositions: multisets of exactly `slotGames` game types. */
function feasibleCompositions(
  slotGames: number,
  M: number,
  F: number,
  poolMode: 'single' | 'gendered',
): GameType[][] {
  const allowed: GameType[] = poolMode === 'single' ? ['free'] : ['mens', 'womens', 'mixed'];
  const comps: GameType[][] = [];
  const cur: GameType[] = [];
  (function gen(start: number, male: number, female: number) {
    if (cur.length === slotGames) {
      comps.push([...cur]);
      return;
    }
    for (let i = start; i < allowed.length; i++) {
      const t = allowed[i];
      const nm = male + seatsM(t);
      const nf = female + seatsF(t);
      if (poolMode === 'gendered' && (nm > M || nf > F)) continue;
      cur.push(t);
      gen(i, nm, nf); // i (not i+1): repeats allowed; non-decreasing = canonical (no perms)
      cur.pop();
    }
  })(0, 0, 0);
  return comps;
}

/**
 * Stage 2 — pack the event-TOTAL type counts into T time slots. Each slot gets
 * one feasible composition of `slotGames` games; compositions are chosen greedily
 * to INTERLEAVE types over time (so one court alternates 남복/여복 instead of
 * clustering them), while consuming the totals exactly. Complete backtracking,
 * so it finds a layout whenever one exists. Returns null if unpackable.
 */
function packComposition(
  counts: GameTypeCounts,
  slotGames: number,
  T: number,
  M: number,
  F: number,
  poolMode: 'single' | 'gendered',
  rng: () => number,
): GameType[][] | null {
  const comps = feasibleCompositions(slotGames, M, F, poolMode);
  if (comps.length === 0) return null;

  const target: Record<GameType, number> = {
    mens: counts.mens,
    womens: counts.womens,
    mixed: counts.mixed,
    free: counts.free,
  };
  const rem: Record<GameType, number> = { ...target };
  const result: GameType[][] = [];
  let nodes = 0;
  const NODE_CAP = 200000;

  const compCount = (comp: GameType[]): Record<GameType, number> => {
    const c: Record<GameType, number> = { mens: 0, womens: 0, mixed: 0, free: 0 };
    for (const t of comp) c[t]++;
    return c;
  };

  function solve(slot: number): boolean {
    if (++nodes > NODE_CAP) return false;
    if (slot === T) {
      return rem.mens === 0 && rem.womens === 0 && rem.mixed === 0 && rem.free === 0;
    }
    // Rank feasible compositions by how much they use the "most behind" types,
    // so each type is spread evenly across the T slots (time interleaving). A
    // small bonus for differing from the previous slot prefers strict alternation
    // (남복,여복,남복,… rather than 남복,남복,여복,여복). Slot ORDER never changes
    // per-player counts (totals are fixed), so this is fairness-safe.
    const prevSig = slot > 0 ? [...result[slot - 1]].sort().join(',') : '';
    const ranked = comps
      .map((comp) => {
        const c = compCount(comp);
        if (c.mens > rem.mens || c.womens > rem.womens || c.mixed > rem.mixed || c.free > rem.free) {
          return null;
        }
        let score = 0;
        for (const t of comp) score += rem[t] / (target[t] || 1);
        if ([...comp].sort().join(',') !== prevSig) score += 0.05;
        return { comp, c, score: score + (rng() - 0.5) * 1e-3 };
      })
      .filter((x): x is { comp: GameType[]; c: Record<GameType, number>; score: number } => x !== null)
      .sort((a, b) => b.score - a.score);

    for (const { comp, c } of ranked) {
      rem.mens -= c.mens; rem.womens -= c.womens; rem.mixed -= c.mixed; rem.free -= c.free;
      result[slot] = comp;
      if (solve(slot + 1)) return true;
      rem.mens += c.mens; rem.womens += c.womens; rem.mixed += c.mixed; rem.free += c.free;
    }
    return false;
  }

  return solve(0) ? result : null;
}

/** Existence check used by Stage 1 to only keep packable allocations. */
function canPackTotals(counts: GameTypeCounts, slotGames: number, T: number, M: number, F: number): boolean {
  return packComposition(counts, slotGames, T, M, F, 'gendered', mulberry32(0x9e3779b9)) !== null;
}

/**
 * Distribute chosen players across the games needing them (round-robin over an
 * NTRP-sorted list so high/low skill spreads across games, not clumped).
 */
function dealRoundRobin(
  players: MatchParticipant[],
  needs: { gameIdx: number; count: number }[],
): Map<number, MatchParticipant[]> {
  const result = new Map<number, MatchParticipant[]>();
  needs.forEach((n) => result.set(n.gameIdx, []));
  const sorted = [...players].sort((a, b) => getNtrp(b) - getNtrp(a));
  let pi = 0;
  let remaining = needs.reduce((s, n) => s + n.count, 0);
  while (remaining > 0) {
    let progressed = false;
    for (const need of needs) {
      const bucket = result.get(need.gameIdx)!;
      if (bucket.length < need.count && pi < sorted.length) {
        bucket.push(sorted[pi++]);
        remaining--;
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return result;
}

type Attempt = {
  games: GameSlot[];
  spread: number;
  cost: number;
};

/** One full assignment attempt for a given seed. */
function buildAttempt(
  confirmed: MatchParticipant[],
  males: MatchParticipant[],
  females: MatchParticipant[],
  alloc: Allocation,
  courts: { name: string }[],
  T: number,
  startTime: string,
  timeSlotMinutes: number,
  seed: number,
): Attempt | null {
  const rng = mulberry32(seed);
  const { slotGames, counts, poolMode } = alloc;

  // Stage 2: interleaved, feasibility-aware packing of the totals into T slots.
  const slotTypes = packComposition(counts, slotGames, T, males.length, females.length, poolMode, rng);
  if (!slotTypes) return null;

  const gameCount = new Map<string, number>();
  const lastSlot = new Map<string, number>();
  confirmed.forEach((p) => gameCount.set(getPlayerId(p), 0));

  const games: GameSlot[] = [];

  for (let s = 0; s < T; s++) {
    const chunk = slotTypes[s];
    if (chunk.length === 0) continue;
    const slotStart = addMinutes(startTime, s * timeSlotMinutes);
    const slotEnd = addMinutes(startTime, (s + 1) * timeSlotMinutes);

    // Stage 3: pick lowest-k per pool.
    let assignments: Map<number, MatchParticipant[]>;

    if (poolMode === 'single') {
      const seats = chunk.length * 4;
      const chosen = pickLowestK(confirmed, seats, gameCount, lastSlot, rng);
      const needs = chunk.map((_, i) => ({ gameIdx: i, count: 4 }));
      assignments = dealRoundRobin(chosen, needs);
    } else {
      const maleSeats = chunk.reduce((sum, t) => sum + (t === 'mens' ? 4 : t === 'mixed' ? 2 : 0), 0);
      const femaleSeats = chunk.reduce((sum, t) => sum + (t === 'womens' ? 4 : t === 'mixed' ? 2 : 0), 0);
      const chosenM = pickLowestK(males, maleSeats, gameCount, lastSlot, rng);
      const chosenF = pickLowestK(females, femaleSeats, gameCount, lastSlot, rng);

      const maleNeeds = chunk
        .map((t, i) => ({ gameIdx: i, count: t === 'mens' ? 4 : t === 'mixed' ? 2 : 0 }))
        .filter((n) => n.count > 0);
      const femaleNeeds = chunk
        .map((t, i) => ({ gameIdx: i, count: t === 'womens' ? 4 : t === 'mixed' ? 2 : 0 }))
        .filter((n) => n.count > 0);

      const maleDeal = dealRoundRobin(chosenM, maleNeeds);
      const femaleDeal = dealRoundRobin(chosenF, femaleNeeds);
      assignments = new Map<number, MatchParticipant[]>();
      chunk.forEach((_, i) => {
        assignments.set(i, [...(maleDeal.get(i) ?? []), ...(femaleDeal.get(i) ?? [])]);
      });
    }

    // Stage 4: build games from the four-player foursomes.
    chunk.forEach((gameType, courtIdx) => {
      const foursome = assignments.get(courtIdx) ?? [];
      if (foursome.length !== 4) return; // should not happen; skip defensively
      foursome.forEach((p) => {
        const pid = getPlayerId(p);
        gameCount.set(pid, (gameCount.get(pid) ?? 0) + 1);
        lastSlot.set(pid, s);
      });
      const { teamA, teamB } = pairByNtrp(foursome, gameType);
      games.push({
        timeSlotIndex: s,
        courtIndex: courtIdx,
        courtName: courts[courtIdx]?.name ?? `${courtIdx + 1}코트`,
        gameType,
        teamA,
        teamB,
        startTime: slotStart,
        endTime: slotEnd,
      });
    });
  }

  // Score the attempt over the ELIGIBLE pool (unknown genders sit out in
  // gendered/mixed modes and must not count against fairness).
  const pool = poolMode === 'single' ? confirmed : [...males, ...females];
  const values = pool.map((p) => gameCount.get(getPlayerId(p)) ?? 0);
  const spread = values.length ? Math.max(...values) - Math.min(...values) : 0;
  const cost = secondaryCost(games);
  return { games, spread, cost };
}

/** Lower is better: NTRP imbalance within games + repeated partner pairs. */
function secondaryCost(games: GameSlot[]): number {
  let cost = 0;
  const pairSeen = new Map<string, number>();
  for (const g of games) {
    const aN = getNtrp(g.teamA.player1) + getNtrp(g.teamA.player2);
    const bN = getNtrp(g.teamB.player1) + getNtrp(g.teamB.player2);
    cost += Math.abs(aN - bN);
    for (const [x, y] of [
      [g.teamA.player1, g.teamA.player2],
      [g.teamB.player1, g.teamB.player2],
    ]) {
      const key = [getPlayerId(x), getPlayerId(y)].sort().join('|');
      const prev = pairSeen.get(key) ?? 0;
      cost += prev * 2; // repeated partners penalized
      pairSeen.set(key, prev + 1);
    }
  }
  return cost;
}

// ============================================================
// Main V2 Export
// ============================================================

export function generateDrawV2(input: DrawInputV2): DrawResultV2 {
  const { participants, courts, gamesPerCourt, mode, startTime, timeSlotMinutes, seed } = input;

  const confirmed = participants.filter((p) => p.status === 'confirmed');
  if (confirmed.length < 4) {
    throw new Error('경기를 위해 최소 4명의 참가자가 필요합니다');
  }

  // Downgrade to free when too many unknown genders.
  let effectiveMode = mode;
  const unknownCount = confirmed.filter((p) => getGender(p) === null).length;
  if (mode !== 'free' && unknownCount > confirmed.length * 0.3) effectiveMode = 'free';

  const males = confirmed.filter((p) => getGender(p) === 'M');
  const females = confirmed.filter((p) => getGender(p) === 'F');

  if (effectiveMode === 'mixed_only' && (males.length === 0 || females.length === 0)) {
    throw new Error('혼복 모드에는 남성과 여성 참가자가 모두 필요합니다. 다른 모드를 선택해주세요.');
  }

  const T = gamesPerCourt;
  const alloc = computeAllocation(effectiveMode, males.length, females.length, confirmed.length, courts.length, T);

  if (alloc.gEff === 0) {
    throw new Error('선택한 모드로 진행할 수 있는 경기가 없습니다. 참가자 구성이나 모드를 확인해주세요.');
  }

  // Retry across seeds; keep the best (lowest spread, then secondary cost).
  const K = 40;
  const baseSeed = seed ?? Math.floor(Math.random() * 0x7fffffff);
  let best: Attempt | null = null;
  for (let attempt = 0; attempt < K; attempt++) {
    const candidate = buildAttempt(
      confirmed,
      males,
      females,
      alloc,
      courts,
      T,
      startTime,
      timeSlotMinutes,
      (baseSeed + attempt * 2654435761) >>> 0,
    );
    if (!candidate) continue;
    if (!best || candidate.spread < best.spread || (candidate.spread === best.spread && candidate.cost < best.cost)) {
      best = candidate;
    }
    if (best.spread <= alloc.structuralMinSpread) break; // can't do better
  }

  if (!best) {
    throw new Error('대진표를 생성할 수 없습니다. 참가자 구성을 확인해주세요.');
  }

  const fairnessPool = effectiveMode === 'free' ? confirmed : [...males, ...females];
  validateDraw(best.games, fairnessPool, alloc.structuralMinSpread);

  // Sit-outs per slot.
  const sitOutsPerSlot = new Map<number, MatchParticipant[]>();
  for (let s = 0; s < T; s++) {
    const playingIds = new Set<string>();
    best.games
      .filter((g) => g.timeSlotIndex === s)
      .forEach((g) => {
        [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2].forEach((p) =>
          playingIds.add(getPlayerId(p)),
        );
      });
    const sitting = confirmed.filter((p) => !playingIds.has(getPlayerId(p)));
    if (sitting.length > 0) sitOutsPerSlot.set(s, sitting);
  }

  // Player summaries.
  const summaryMap = new Map<string, PlayerSummary>();
  confirmed.forEach((p) => summaryMap.set(getPlayerId(p), { participant: p, totalGames: 0, games: [] }));
  best.games.forEach((g, idx) => {
    [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2].forEach((p) => {
      const summ = summaryMap.get(getPlayerId(p));
      if (summ) {
        summ.totalGames++;
        summ.games.push({ timeSlotIndex: g.timeSlotIndex, courtName: g.courtName, gameType: g.gameType, gameOrder: idx + 1 });
      }
    });
  });

  return {
    games: best.games,
    playerSummary: Array.from(summaryMap.values()),
    totalTimeSlots: T,
    sitOuts: Array.from(sitOutsPerSlot.entries()).map(([slot, players]) => ({ timeSlotIndex: slot, players })),
  };
}

/**
 * Post-generation validation. Throws on any correctness violation, INCLUDING
 * game-count imbalance beyond the structural minimum (never ship an unfair draw).
 */
function validateDraw(
  games: GameSlot[],
  fairnessPool: MatchParticipant[],
  maxAllowedSpread: number,
): void {
  const critical: string[] = [];

  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    const players = [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2];
    const ids = players.map(getPlayerId);

    if (new Set(ids).size !== 4) {
      critical.push(`경기 ${i + 1}: 같은 선수가 중복 배정됨`);
    }

    const males = players.filter((p) => getGender(p) === 'M').length;
    const females = players.filter((p) => getGender(p) === 'F').length;
    if (g.gameType === 'mixed' && (males !== 2 || females !== 2)) {
      critical.push(`경기 ${i + 1}: 혼복 구성 오류 (${males}M+${females}F)`);
    }
    if (g.gameType === 'mens' && males !== 4) critical.push(`경기 ${i + 1}: 남복 구성 오류`);
    if (g.gameType === 'womens' && females !== 4) critical.push(`경기 ${i + 1}: 여복 구성 오류`);
  }

  // No double-booking within a time slot.
  const slotMap = new Map<number, string[]>();
  for (const g of games) {
    const ids = [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2].map(getPlayerId);
    if (!slotMap.has(g.timeSlotIndex)) slotMap.set(g.timeSlotIndex, []);
    slotMap.get(g.timeSlotIndex)!.push(...ids);
  }
  for (const [slot, ids] of slotMap) {
    if (new Set(ids).size !== ids.length) {
      critical.push(`시간 ${slot}: 같은 선수가 두 코트에 동시 배정됨`);
    }
  }

  // Game-count fairness — measured over the eligible pool only.
  const played = new Map<string, number>();
  for (const g of games) {
    [g.teamA.player1, g.teamA.player2, g.teamB.player1, g.teamB.player2].forEach((p) => {
      played.set(getPlayerId(p), (played.get(getPlayerId(p)) ?? 0) + 1);
    });
  }
  const counts = fairnessPool.map((p) => played.get(getPlayerId(p)) ?? 0);
  const spread = counts.length ? Math.max(...counts) - Math.min(...counts) : 0;

  if (critical.length > 0) {
    console.error('[draw-engine] critical:', critical);
    throw new Error('대진표를 생성할 수 없습니다. 참가자 구성을 확인해주세요.');
  }
  if (spread > maxAllowedSpread) {
    console.error(`[draw-engine] unfair spread=${spread} > allowed=${maxAllowedSpread}`);
    throw new Error('공평한 대진표를 만들지 못했습니다. 코트 수나 경기 수를 조정해 다시 시도해주세요.');
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
  const confirmed = input.participants.filter((p) => p.status === 'confirmed');
  const {
    courtCount, gamesPerCourt, drawType,
    timeSlotMinutes = 30, startTime = '08:00', courtNames = [],
  } = input;

  let teams: TeamPair[] = [];
  let sitOuts: MatchParticipant[] = [];

  switch (drawType) {
    case 'mixed_doubles': {
      const males = confirmed.filter((p) => getGender(p) === 'M');
      const females = confirmed.filter((p) => getGender(p) === 'F');
      const noGender = confirmed.filter((p) => !getGender(p));
      const pairCount = Math.min(males.length, females.length);
      if (pairCount < 2) throw new Error('혼복을 위해 남녀 각 2명 이상이 필요합니다');
      sitOuts = [...males.slice(pairCount), ...females.slice(pairCount), ...noGender];
      teams = serpentinePairMixed(males.slice(0, pairCount), females.slice(0, pairCount));
      break;
    }
    case 'mens_doubles': {
      const males = confirmed.filter((p) => getGender(p) === 'M');
      if (males.length < 4) throw new Error('남복을 위해 최소 4명의 남성 참가자가 필요합니다');
      const usable = males.length % 2 === 0 ? males : males.slice(0, -1);
      if (males.length % 2 !== 0) sitOuts.push(males[males.length - 1]);
      sitOuts.push(...confirmed.filter((p) => getGender(p) !== 'M'));
      teams = serpentinePair(usable);
      break;
    }
    case 'womens_doubles': {
      const females = confirmed.filter((p) => getGender(p) === 'F');
      if (females.length < 4) throw new Error('여복을 위해 최소 4명의 여성 참가자가 필요합니다');
      const usable = females.length % 2 === 0 ? females : females.slice(0, -1);
      if (females.length % 2 !== 0) sitOuts.push(females[females.length - 1]);
      sitOuts.push(...confirmed.filter((p) => getGender(p) !== 'F'));
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
  const confirmed = input.participants.filter((p) => p.status === 'confirmed');

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
