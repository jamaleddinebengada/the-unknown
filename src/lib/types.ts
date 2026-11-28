export interface Category { id: string; emoji: string; name_en: string; name_fr: string; name_ar: string; color: string; sort: number }

export interface Availability { id: string; categories: string[]; starts_at: string; ends_at: string; max_km: number; group_pref: 'one' | 'group' | 'any'; budget: string; note: string | null }

export interface MyProfile {
  id: string; display_name: string | null; birth_date: string | null; gender: string | null; bio: string | null;
  interests: string[]; languages: string[]; country_code: string | null; city: string | null;
  photo_path: string | null; gallery: string[]; show_age: boolean; discoverable: boolean;
  is_verified: boolean; is_admin: boolean; status: string; tier: 'free' | 'plus' | 'elite'; onboarded: boolean;
}
export interface Zone { enabled: boolean; city: string | null; country_code: string | null; updated_at: string; expired: boolean }
export interface Boot { profile: MyProfile; zone: Zone | null; availability: Availability | null; unread: number }

export interface Person {
  id: string; name: string | null; age: number | null; gender: string | null; bio: string | null;
  photo_path: string | null; gallery: string[]; city: string | null; country_code: string | null;
  distance: string | null; online: boolean; verified: boolean; tier: string;
  interests: string[]; languages: string[]; shared_interests: string[]; shared_languages: string[];
  free: { until: string; starts_at: string; categories: string[]; group_pref: string; budget: string; note: string | null; max_km: number; shared_categories: string[] } | null;
  is_me?: boolean; member_since?: string; conversation_id?: string | null; hosting?: number;
  request?: { id: string; status: string; incoming: boolean } | null;
}

export interface Activity {
  id: string; title: string; description: string | null; category: string; cover_path: string | null;
  starts_at: string; ends_at: string | null; place_name: string; city: string | null; distance: string | null;
  max: number; price: string | null; status: string; going: number;
  host: { id: string; name: string | null; photo_path: string | null; verified: boolean };
  is_host: boolean; my_status: 'pending' | 'approved' | 'declined' | 'left' | null;
  conversation_id?: string | null;
  participants?: { id: string; name: string | null; photo_path: string | null; status: string; message: string | null }[];
}

export interface Conversation {
  id: string; kind: 'direct' | 'group'; title: string | null; activity_id: string | null; last_at: string;
  last: { body: string | null; kind: string; mine: boolean } | null; unread: number; members: number; other: Person | null;
}
export interface Inbox { requests: { id: string; message: string | null; category: string | null; created_at: string; person: Person }[]; sent: number; conversations: Conversation[] }

export interface Message { id: string; conversation_id: string; sender_id: string | null; kind: 'text' | 'image' | 'system' | 'invite'; body: string | null; media_path: string | null; created_at: string }
export interface Post { id: string; body: string | null; media_path: string | null; created_at: string; activity_id: string | null; author: { id: string; name: string | null; photo_path: string | null; city: string | null; verified: boolean }; likes: number; liked: boolean; mine: boolean }
export interface Notification { id: string; type: string; data: Record<string, string>; read_at: string | null; created_at: string }
