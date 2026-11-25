export type PostType = 'thought' | 'question' | 'secret' | 'story' | 'advice' | 'debate' | 'dream' | 'challenge' | 'travel' | 'business';
export type Audience = 'everyone' | 'topic' | 'my_country' | 'countries';
export type InterestStatus = 'pending' | 'accepted' | 'declined';

export interface Profile {
  id: string;
  unknown_number: number;
  username: string | null;
  birth_date: string | null;
  country_code: string | null;
  gender: string | null;
  languages: string[];
  interests: string[];
  conversation_prefs: string[];
  discover_topics: string[];
  personality_tags: string[];
  tagline: string | null;
  avatar_seed: string;
  show_age: boolean;
  show_country: boolean;
  show_online: boolean;
  who_can_message: 'approved' | 'nobody';
  onboarding_complete: boolean;
  is_premium: boolean;
  tier: 'free' | 'plus' | 'vip';
  is_admin?: boolean;
  height_cm?: number | null; zodiac?: string | null; job?: string | null; education?: string | null;
  smoking?: string | null; drinking?: string | null; exercise?: string | null; pets?: string | null;
  boosted_until?: string | null;
  display_name: string | null;
  bio: string | null;
  looking_for: 'friendship' | 'conversation' | 'relationship' | null;
  interested_in: string[];
  is_verified: boolean;
  hide_visits: boolean;
  photo_visibility: 'public' | 'revealed' | 'hidden';
  profile_theme: 'rose' | 'plum' | 'gold' | 'ocean' | 'sunset';
  status: 'active' | 'suspended' | 'banned';
  created_at: string;
}

export interface FeedPost {
  id: string;
  type: PostType;
  category: string | null;
  content: string;
  image_path: string | null;
  voice_path: string | null;
  audience: Audience;
  created_at: string;
  like_count: number;
  comment_count: number;
  interested_count: number;
  author_number: number;
  author_country: string | null;
  author_age: number | null;
  author_avatar_seed: string;
  is_mine: boolean;
  liked_by_me: boolean;
  my_interest: InterestStatus | null;
}

export interface Comment {
  id: string;
  content: string;
  created_at: string;
  author_number: number;
  author_country: string | null;
  author_avatar_seed: string;
  is_mine: boolean;
  can_delete: boolean;
}

export interface InterestedUser {
  interest_id: string;
  intro: string | null;
  status: InterestStatus;
  created_at: string;
  conversation_id: string | null;
  unknown_number: number;
  country_code: string | null;
  age_range: string | null;
  interests: string[];
  tagline: string | null;
  avatar_seed: string;
  shared_interests: number;
}

export interface ConversationSummary {
  conversation_id: string;
  kind: 'direct' | 'group';
  stage: number;
  last_message_at: string;
  ended: boolean;
  archived: boolean;
  other_number: number | null;
  other_country: string | null;
  other_avatar_seed: string | null;
  other_online: boolean | null;
  member_count: number;
  last_body: string | null;
  last_kind: string | null;
  last_is_mine: boolean | null;
  unread: number;
  post_snippet: string | null;
  revealed: boolean;
}

export interface ConversationDetail {
  conversation_id: string;
  kind: 'direct' | 'group';
  stage: number;
  ended: boolean;
  created_at: string;
  other_number: number | null;
  other_country: string | null;
  other_avatar_seed: string | null;
  other_interests: string[] | null;
  my_reveal_consent: boolean;
  other_reveal_consent: boolean | null;
  message_count: number;
  post_snippet: string | null;
}

export interface Message {
  id: string;
  kind: 'text' | 'image' | 'voice' | 'system' | 'prompt' | 'video' | 'gift';
  body: string | null;
  media_path: string | null;
  reply_to: string | null;
  created_at: string;
  is_mine: boolean | null;
  sender_number: number | null;
  sender_avatar_seed: string | null;
}

export interface MysteryMatch {
  match_id: string;
  mode: string;
  compatibility: number;
  shared_interests: string[];
  i_accepted: boolean | null;
  they_accepted: boolean | null;
  conversation_id: string | null;
  other_number: number;
  other_country: string | null;
  other_age: number | null;
  other_avatar_seed: string;
  other_tagline: string | null;
  other_tags: string[];
  other_languages: string[];
  is_incoming: boolean;
}

export interface PublicProfile {
  unknown_number: number;
  country_code: string | null;
  age_range: string | null;
  languages: string[];
  interests: string[];
  personality_tags: string[];
  tagline: string | null;
  avatar_seed: string;
  post_count: number;
  member_since: string;
  is_me: boolean;
}

export interface AppNotification {
  id: string;
  type: string;
  data: Record<string, string>;
  read_at: string | null;
  created_at: string;
}

export interface Challenge { key: string; title: string; subtitle: string; xp: number; done: boolean; icon: string }
export interface ChallengeState {
  xp: number; level: number; level_xp: number; per_level: number; active_days: number; matched_today: boolean; challenges: Challenge[];
  streak?: number;
  weekly?: { key: string; title: string; progress: number; target: number; icon: string }[];
  week_resets_at?: string;
}

export interface Plan { tier: 'free' | 'plus' | 'vip'; matches_today: number; match_limit: number; supers_today: number; super_limit: number; renews_at: string | null; sub_status: string | null }
export interface Person { unknown_number: number; avatar_seed: string; country_code: string | null; age: number | null; interests: string[]; tagline: string | null; tier: 'free' | 'plus' | 'vip'; online: boolean; has_photo: boolean }
export interface MatchFilters { country?: string | null; minAge?: number | null; maxAge?: number | null }

/** A member as returned by discover_people / get_person (never ids or coordinates). */
export interface PersonCard {
  unknown_number: number; display_name: string | null; avatar_seed: string; age: number | null; gender: string | null;
  bio: string | null; looking_for: string | null; languages: string[]; interests: string[]; shared_interests: string[];
  country_code: string | null; city: string | null; distance_band: string | null; online: boolean; recently_active: boolean;
  is_new: boolean; is_verified: boolean; tier: 'free' | 'plus' | 'vip'; has_photo: boolean; is_favorite: boolean; i_liked: boolean;
  traits?: import('@/features/people/traits').Traits; boosted?: boolean;
  post_count?: number; member_since?: string; personality_tags?: string[]; is_me?: boolean; super?: boolean; visited_at?: string;
}
export interface DiscoverFilters { min_age?: number | null; max_age?: number | null; genders?: string[]; online?: boolean; recent?: boolean; new?: boolean; interests?: string[]; language?: string | null; country?: string | null; city?: string | null }
