// Database types - update these when you run `supabase gen types typescript`
// For now, manually defined based on our schema

export type Profile = {
  id: string;
  display_name: string;
  real_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  ntrp_level: number | null;
  gender: 'M' | 'F' | null;
  bio: string | null;
  region: string | null;
  tennis_start_date: string | null;
  is_onboarded: boolean;
  is_admin: boolean;
  is_banned: boolean;
  banned_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type Club = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  region: string | null;
  main_court: string | null;
  invite_code: string;
  is_public: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type ClubRole = 'owner' | 'admin' | 'member';

export type ClubMember = {
  id: string;
  club_id: string;
  user_id: string;
  role: ClubRole;
  joined_at: string;
  profiles?: Profile;
};

export type MatchStatus = 'upcoming' | 'in_progress' | 'completed' | 'cancelled';
export type MatchFormat = 'doubles' | 'singles' | 'mixed_doubles';

export type Match = {
  id: string;
  club_id: string;
  title: string;
  description: string | null;
  location: string | null;
  match_date: string;
  start_time: string | null;
  end_time: string | null;
  court_count: number;
  max_participants: number | null;
  allow_guests: boolean;
  registration_closed: boolean;
  status: MatchStatus;
  format: MatchFormat;
  created_by: string;
  created_at: string;
  updated_at: string;
  match_participants?: MatchParticipant[];
};

export type ParticipantStatus = 'confirmed' | 'pending' | 'rejected' | 'withdrawn' | 'waitlisted';
export type ParticipantType = 'member' | 'guest';

export type MatchParticipant = {
  id: string;
  match_id: string;
  user_id: string | null;
  guest_name: string | null;
  guest_phone: string | null;
  guest_gender: 'M' | 'F' | null;
  participant_type: ParticipantType;
  status: ParticipantStatus;
  ntrp_override: number | null;
  introduction: string | null;
  requested_at: string;
  responded_at: string | null;
  responded_by: string | null;
  profiles?: Profile;
};

export type LegacyDrawType = 'random' | 'ntrp_balanced' | 'mixed_gender' | 'manual';
export type DrawModeV2 = 'mixed_all' | 'mixed_only' | 'gendered_only' | 'free';
export type DrawType = LegacyDrawType | 'mixed_doubles' | 'mens_doubles' | 'womens_doubles' | 'free' | DrawModeV2;

export type Draw = {
  id: string;
  match_id: string;
  round_number: number;
  draw_type: DrawType;
  is_finalized: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
  games?: Game[];
};

export type GameStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type Game = {
  id: string;
  draw_id: string;
  court_number: number;
  game_order: number;
  team_a_player1_id: string | null;
  team_a_player2_id: string | null;
  team_b_player1_id: string | null;
  team_b_player2_id: string | null;
  score_team_a: number | null;
  score_team_b: number | null;
  set_scores: { team_a: number; team_b: number }[] | null;
  winner: 'team_a' | 'team_b' | null;
  status: GameStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
};

export type PlayerGameStat = {
  user_id: string;
  game_id: string;
  draw_id: string;
  match_id: string;
  club_id: string;
  match_date: string;
  score_team_a: number | null;
  score_team_b: number | null;
  result: 'win' | 'loss' | null;
  team: 'team_a' | 'team_b';
};

export type JoinRequestStatus = 'pending' | 'approved' | 'rejected';

export type ClubJoinRequest = {
  id: string;
  club_id: string;
  user_id: string;
  message: string | null;
  introduction: string | null;
  status: JoinRequestStatus;
  responded_by: string | null;
  created_at: string;
  responded_at: string | null;
  profiles?: Profile;
};

export type NotificationType =
  | 'match_invite'
  | 'guest_approved'
  | 'guest_rejected'
  | 'match_reminder'
  | 'draw_published'
  | 'score_updated'
  | 'role_changed'
  | 'join_request'
  | 'join_approved'
  | 'join_rejected';

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  data: Record<string, string>;
  is_read: boolean;
  created_at: string;
};

export type RecruitmentType = 'member_recruit' | 'guest_recruit';
export type RecruitmentPost = {
  id: string;
  club_id: string;
  match_id: string | null;
  created_by: string;
  type: RecruitmentType;
  title: string;
  description: string | null;
  match_date: string | null;
  location: string | null;
  needed_count: number | null;
  male_slots: number | null;
  female_slots: number | null;
  any_slots: number | null;
  game_format: MatchFormat | null;
  ntrp_min: number | null;
  ntrp_max: number | null;
  status: 'open' | 'closed';
  created_at: string;
  clubs?: { name: string; logo_url: string | null; region: string | null };
  profiles?: { display_name: string; avatar_url: string | null };
};

export type MatchTemplate = {
  id: string;
  club_id: string;
  name: string;
  title_pattern: string;
  description: string | null;
  location: string | null;
  start_time: string | null;
  end_time: string | null;
  court_count: number;
  max_participants: number | null;
  allow_guests: boolean;
  format: MatchFormat;
  day_of_week: number;
  frequency_weeks: number;
  is_active: boolean;
  last_created_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};
