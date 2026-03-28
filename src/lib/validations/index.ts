import { z } from 'zod';

// ============================================================
// Shared Primitives
// ============================================================

/** Strip HTML tags and trim whitespace to prevent stored XSS */
function sanitize(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim();
}

/** Zod transform that sanitises text input */
const sanitizedText = z.string().transform(sanitize);

export const uuidSchema = z.string().uuid();

export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, '올바른 날짜 형식이 아닙니다 (YYYY-MM-DD)');

export const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, '올바른 시간 형식이 아닙니다 (HH:MM)');

export const ntrpSchema = z.number().min(1.0).max(7.0).multipleOf(0.5).nullable();

export const genderSchema = z.enum(['M', 'F']);

export const clubRoleSchema = z.enum(['owner', 'admin', 'member']);

export const matchStatusSchema = z.enum(['upcoming', 'in_progress', 'completed', 'cancelled']);

export const matchFormatSchema = z.enum(['doubles', 'singles', 'mixed_doubles']);

export const drawTypeSchema = z.enum(['random', 'ntrp_balanced', 'mixed_gender', 'mixed_doubles', 'mens_doubles', 'womens_doubles', 'free']);

export const feedTypeSchema = z.enum(['club', 'personal']);

export const fileTypeSchema = z.enum(['image', 'video']);

// ============================================================
// Club Schemas
// ============================================================

export const createClubSchema = z.object({
  name: sanitizedText.pipe(z.string().min(1, '클럽 이름을 입력해주세요').max(50)),
  description: sanitizedText.pipe(z.string().max(500)).optional(),
  region: sanitizedText.pipe(z.string().max(100)).optional(),
  main_court: sanitizedText.pipe(z.string().max(200)).optional(),
  is_public: z.boolean().default(true),
});

export const updateClubSchema = z.object({
  name: sanitizedText.pipe(z.string().min(1, '클럽 이름을 입력해주세요').max(50)),
  description: sanitizedText.pipe(z.string().max(500)).nullable(),
  region: sanitizedText.pipe(z.string().max(100)).nullable(),
  main_court: sanitizedText.pipe(z.string().max(200)).nullable(),
});

export const inviteCodeSchema = z.string().min(1).max(20).regex(/^[a-zA-Z0-9]+$/);

// ============================================================
// Match Schemas
// ============================================================

export const createMatchSchema = z.object({
  club_id: uuidSchema,
  title: sanitizedText.pipe(z.string().min(1, '경기 제목을 입력해주세요').max(100)),
  description: sanitizedText.pipe(z.string().max(1000)).optional(),
  location: sanitizedText.pipe(z.string().max(200)).optional(),
  match_date: dateSchema,
  start_time: timeSchema.optional(),
  end_time: timeSchema.optional(),
  court_count: z.number().int().min(1).max(20),
  max_participants: z.number().int().min(2).max(100).optional(),
  allow_guests: z.boolean().default(true),
  format: matchFormatSchema.default('doubles'),
});

export const updateMatchSchema = z.object({
  title: sanitizedText.pipe(z.string().min(1, '경기 제목을 입력해주세요').max(100)),
  description: sanitizedText.pipe(z.string().max(1000)).optional(),
  location: sanitizedText.pipe(z.string().max(200)).optional(),
  match_date: dateSchema,
  start_time: timeSchema.optional(),
  end_time: timeSchema.optional(),
  court_count: z.number().int().min(1).max(20),
  max_participants: z.number().int().min(2).max(100).optional(),
  format: matchFormatSchema,
});

export const guestApplySchema = z.object({
  name: sanitizedText.pipe(z.string().min(1, '이름을 입력해주세요').max(50)),
  phone: z.string().max(20).regex(/^[0-9\-+() ]*$/, '올바른 전화번호 형식이 아닙니다').optional(),
});

export const offlineParticipantSchema = z.object({
  name: sanitizedText.pipe(z.string().min(1, '이름을 입력해주세요').max(50)),
  gender: genderSchema,
  ntrpLevel: z.number().min(1.0).max(7.0).optional(),
});

// ============================================================
// Game Schemas
// ============================================================

export const submitScoreSchema = z.object({
  gameId: uuidSchema,
  scoreA: z.number().int().min(0).max(99),
  scoreB: z.number().int().min(0).max(99),
});

export const updateGamePlayersSchema = z.object({
  gameId: uuidSchema,
  data: z.object({
    team_a_player1_id: uuidSchema.nullable().optional(),
    team_a_player2_id: uuidSchema.nullable().optional(),
    team_b_player1_id: uuidSchema.nullable().optional(),
    team_b_player2_id: uuidSchema.nullable().optional(),
  }),
});

// ============================================================
// Media Schemas
// ============================================================

export const mediaFileSchema = z.object({
  url: z.string().url(),
  type: fileTypeSchema,
});

export const saveMediaSchema = z.object({
  files: z.array(mediaFileSchema).min(1).max(10),
  caption: sanitizedText.pipe(z.string().max(500)).nullable(),
});

export const updateMediaSchema = z.object({
  mediaId: uuidSchema,
  caption: sanitizedText.pipe(z.string().max(500)).nullable(),
});

export const commentBodySchema = sanitizedText.pipe(
  z.string().min(1, '댓글을 입력해주세요').max(500, '댓글은 500자 이내로 입력해주세요')
);

// ============================================================
// Profile Schemas
// ============================================================

export const updateProfileSchema = z.object({
  display_name: sanitizedText.pipe(z.string().min(1, '닉네임을 입력해주세요').max(30)),
  bio: sanitizedText.pipe(z.string().max(200)).nullable(),
  ntrp_level: z.number().min(1.0).max(7.0).nullable(),
  tennis_start_date: z.string().regex(/^\d{4}-\d{2}-01$/).nullable(),
  gender: genderSchema.optional(),
});

export const completeOnboardingSchema = z.object({
  display_name: sanitizedText.pipe(z.string().min(1, '닉네임을 입력해주세요').max(30)),
  gender: genderSchema,
  bio: sanitizedText.pipe(z.string().max(200)).nullable(),
});

export const avatarUrlSchema = z.string().url();

// ============================================================
// Draw Schemas
// ============================================================

export const generateDrawSchema = z.object({
  matchId: uuidSchema,
  drawType: drawTypeSchema,
  roundNumber: z.number().int().min(1).max(50).default(1),
  gamesPerCourt: z.number().int().min(1).max(50).optional(),
  timeSlotMinutes: z.number().int().min(5).max(120).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  courtNames: z.array(z.string().max(50)).optional(),
});

export const deleteDrawSchema = z.object({
  drawId: uuidSchema,
  matchId: uuidSchema,
});

// ============================================================
// Recruitment Schemas
// ============================================================

export const recruitmentTypeSchema = z.enum(['member_recruit', 'guest_recruit']);

export const createRecruitmentSchema = z.object({
  club_id: uuidSchema,
  type: recruitmentTypeSchema,
  title: sanitizedText.pipe(z.string().min(1, '제목을 입력해주세요').max(100)),
  description: sanitizedText.pipe(z.string().max(1000)).optional(),
  match_id: uuidSchema.optional(),
  match_date: dateSchema.optional(),
  location: sanitizedText.pipe(z.string().max(200)).optional(),
  needed_count: z.number().int().min(1).max(100).optional(),
  ntrp_min: z.number().min(1.0).max(7.0).optional(),
  ntrp_max: z.number().min(1.0).max(7.0).optional(),
});
