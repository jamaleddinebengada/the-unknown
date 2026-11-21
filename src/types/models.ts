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
  kind: 'text' | 'image' | 'voice' | 'system' | 'prompt';
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
