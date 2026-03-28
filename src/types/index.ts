// Database types - update these when you run `supabase gen types typescript`
// For now, manually defined based on our schema

export type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  phone: string | null;
  ntrp_level: number | null;
  gender: 'M' | 'F' | null;
  bio: string | null;
  region: string | null;
  tennis_start_date: string | null;
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
  status: MatchStatus;
  format: MatchFormat;
  created_by: string;
  created_at: string;
  updated_at: string;
  match_participants?: MatchParticipant[];
};

export type ParticipantStatus = 'confirmed' | 'pending' | 'rejected' | 'withdrawn';
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
  requested_at: string;
  responded_at: string | null;
  responded_by: string | null;
  profiles?: Profile;
};

export type DrawType = 'random' | 'ntrp_balanced' | 'mixed_gender' | 'manual';

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
  set_scores: { a: number; b: number }[] | null;
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

export type NotificationType =
  | 'match_invite'
  | 'guest_approved'
  | 'guest_rejected'
  | 'match_reminder'
  | 'draw_published'
  | 'score_updated'
  | 'role_changed'
  | 'new_follower';

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

export type Media = {
  id: string;
  club_id: string;
  match_id: string | null;
  uploaded_by: string;
  file_url: string;
  file_type: 'image' | 'video';
  file_urls: { url: string; type: 'image' | 'video' }[];
  caption: string | null;
  feed_type: 'club' | 'personal';
  created_at: string;
  like_count?: number;
  comment_count?: number;
  profiles?: { display_name: string; avatar_url: string | null };
  is_liked?: boolean;
};

export type Follow = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type UserProfile = Profile & {
  follower_count?: number;
  following_count?: number;
  is_following?: boolean;
  post_count?: number;
};

export type MediaComment = {
  id: string;
  media_id: string;
  user_id: string;
  body: string;
  created_at: string;
  profiles?: { display_name: string; avatar_url: string | null };
};
