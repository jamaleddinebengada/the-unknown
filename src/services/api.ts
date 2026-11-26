import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type {
  AppNotification, ChallengeState, Comment, ConversationDetail, ConversationSummary, FeedPost, InterestedUser, Message,
  DiscoverFilters, MatchFilters, MysteryMatch, PersonCard, Person, Plan, Profile, PublicProfile, PostType, Audience,
} from '@/types/models';

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

/* ---------------- profile ---------------- */
export async function fetchMyProfile(): Promise<Profile | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', u.user.id).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export type ProfileUpdate = Partial<Pick<Profile,
  'username' | 'birth_date' | 'country_code' | 'gender' | 'languages' | 'interests' | 'conversation_prefs' |
  'discover_topics' | 'personality_tags' | 'tagline' | 'show_age' | 'show_country' | 'show_online' | 'who_can_message' |
  'onboarding_complete' | 'photo_visibility' | 'profile_theme' | 'display_name' | 'bio' | 'looking_for' | 'interested_in' | 'hide_visits' |
  'height_cm' | 'zodiac' | 'job' | 'education' | 'smoking' | 'drinking' | 'exercise' | 'pets'>>;

export async function updateMyProfile(patch: ProfileUpdate) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const { error } = await supabase.from('profiles').update(patch).eq('id', u.user.id);
  if (error) throw error;
}

export const getPublicProfile = (n: number) =>
  rpc<PublicProfile[]>('get_public_profile', { p_number: n }).then((r) => r[0] ?? null);
export const touchPresence = () => rpc<void>('touch_presence');
export const deleteMyAccount = () => rpc<void>('delete_my_account');

/* ---------------- posts ---------------- */
export const PAGE_SIZE = 15;
export const getFeed = (category: string, offset: number) =>
  rpc<FeedPost[]>('get_feed', { p_category: category, p_offset: offset, p_limit: PAGE_SIZE });
export const getPost = (id: string) => rpc<FeedPost[]>('get_post', { p_post: id }).then((r) => r[0] ?? null);
export const getUserPosts = (n: number, offset = 0) =>
  rpc<FeedPost[]>('get_user_posts', { p_number: n, p_offset: offset, p_limit: PAGE_SIZE });
export const searchPosts = (q: string, offset = 0) =>
  rpc<FeedPost[]>('search_posts', { p_query: q, p_offset: offset, p_limit: PAGE_SIZE });

export interface NewPost {
  type: PostType;
  category: string | null;
  content: string;
  audience: Audience;
  audience_countries?: string[];
  image_path?: string | null;
  voice_path?: string | null;
  language?: string | null;
}
export async function createPost(p: NewPost) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const { data, error } = await supabase.from('posts').insert({ ...p, author_id: u.user.id }).select('id').single();
  if (error) throw error;
  return data.id as string;
}
export async function updatePost(id: string, patch: Partial<NewPost>) {
  const { error } = await supabase.from('posts').update(patch).eq('id', id);
  if (error) throw error;
}
export async function deletePost(id: string) {
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) throw error;
}

export async function setLike(postId: string, liked: boolean) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const q = liked
    ? supabase.from('post_likes').insert({ post_id: postId, user_id: u.user.id })
    : supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', u.user.id);
  const { error } = await q;
  if (error && !String(error.message).includes('duplicate')) throw error;
}

export const getComments = (postId: string) => rpc<Comment[]>('get_comments', { p_post: postId });
export async function addComment(postId: string, content: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const { error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: u.user.id, content });
  if (error) throw error;
}
export async function deleteComment(id: string) {
  const { error } = await supabase.from('post_comments').delete().eq('id', id);
  if (error) throw error;
}

/* ---------------- interested ---------------- */
export const expressInterest = (postId: string, intro?: string) =>
  rpc<string | null>('express_interest', { p_post: postId, p_intro: intro ?? null });
export const withdrawInterest = (postId: string) => rpc<void>('withdraw_interest', { p_post: postId });
export const getPostInterests = (postId: string) => rpc<InterestedUser[]>('get_post_interests', { p_post: postId });
export const respondInterest = (interestId: string, accept: boolean, group = false) =>
  rpc<string | null>('respond_interest', { p_interest: interestId, p_accept: accept, p_group: group });

export const getMyPendingInterests = () =>
  rpc<{ post_id: string; snippet: string; pending: number; latest: string }[]>('get_my_pending_interests');

/* ---------------- safety ---------------- */
export const blockUser = (n: number) => rpc<void>('block_user', { p_number: n });
export const unblockUser = (n: number) => rpc<void>('unblock_user', { p_number: n });
export const getBlockedUsers = () => rpc<{ unknown_number: number; avatar_seed: string; blocked_at: string }[]>('get_blocked_users');
export const report = (args: {
  type: 'user' | 'post' | 'comment' | 'message'; reason: string; details?: string; number?: number; targetId?: string;
}) =>
  rpc<void>('report_content', {
    p_type: args.type, p_reason: args.reason, p_details: args.details ?? null,
    p_number: args.number ?? null, p_target_id: args.targetId ?? null,
  });

/* ---------------- conversations ---------------- */
export const getMyConversations = () => rpc<ConversationSummary[]>('get_my_conversations');
export const getConversation = (id: string) =>
  rpc<ConversationDetail[]>('get_conversation', { p_conv: id }).then((r) => r[0] ?? null);
export const getMessages = (id: string, before?: string) =>
  rpc<Message[]>('get_messages', { p_conv: id, p_before: before ?? null, p_limit: 50 });
export async function sendMessage(conversationId: string, body: string, kind: 'text' | 'prompt' | 'image' | 'voice' | 'video' = 'text', mediaPath?: string, replyTo?: string | null) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId, sender_id: u.user.id, body, kind, media_path: mediaPath ?? null, reply_to: replyTo ?? null,
  });
  if (error) throw error;
}
/** Private chat media (only the two participants can read it). */
export async function uploadChatMedia(conversationId: string, localUri: string, kind: 'image' | 'voice' | 'video', mime: string) {
  const ext = kind === 'voice' ? 'm4a' : kind === 'video' ? (mime.includes('quicktime') ? 'mov' : mime.includes('3gp') ? '3gp' : 'mp4') : mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from('chat-media').upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
  return path;
}
export async function chatMediaUrls(paths: string[]) {
  const out = new Map<string, string>();
  if (!paths.length) return out;
  const { data } = await supabase.storage.from('chat-media').createSignedUrls(paths, 3600);
  for (const d of data ?? []) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
  return out;
}
export async function markRead(conversationId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from('conversation_participants').update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).eq('user_id', u.user.id);
}
export async function setArchived(conversationId: string, archived: boolean) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  const { error } = await supabase.from('conversation_participants').update({ archived })
    .eq('conversation_id', conversationId).eq('user_id', u.user.id);
  if (error) throw error;
}
export const endConversation = (id: string) => rpc<void>('end_conversation', { p_conv: id });
export const setRevealConsent = (id: string, consent: boolean, fields: string[]) =>
  rpc<number>('set_reveal_consent', { p_conv: id, p_consent: consent, p_fields: fields });
export const getRevealedIdentity = (id: string) =>
  rpc<{ display_name: string | null; photo_path: string | null; social_handle: string | null; about: string | null }[]>(
    'get_revealed_identity', { p_conv: id }).then((r) => r[0] ?? null);

/* ---------------- matches ---------------- */
export const getMyMatches = () => rpc<MysteryMatch[]>('get_my_matches');
export const findMysteryMatch = (mode: string, f: MatchFilters = {}) =>
  rpc<MysteryMatch[]>('find_mystery_match', { p_mode: mode, p_country: f.country ?? null, p_min_age: f.minAge ?? null, p_max_age: f.maxAge ?? null }).then((r) => r[0] ?? null);
export const connectWith = (n: number) => rpc<MysteryMatch[]>('connect_with', { p_number: n }).then((r) => r[0] ?? null);
/** VIP: accept with a highlight the other person sees (3 per day). */
export const superConnect = (matchId: string) => rpc<string | null>('super_connect', { p_match: matchId });
export const getMySuperMatchIds = () => rpc<string[]>('get_my_super_match_ids').then((r) => new Set(r));

/* ---------------- membership & people ---------------- */
export const getMyPlan = () => rpc<Plan[]>('get_my_plan').then((r) => r[0] ?? null);
export const getPeople = (f: MatchFilters = {}, offset = 0) =>
  rpc<Person[]>('get_people', { p_country: f.country ?? null, p_min_age: f.minAge ?? null, p_max_age: f.maxAge ?? null, p_offset: offset, p_limit: 20 });

/* ---------------- saved favorites (PLUS) ---------------- */
export const toggleSavedPost = (postId: string) => rpc<boolean>('toggle_saved_post', { p_post: postId });
export const getSavedPosts = (offset = 0) => rpc<FeedPost[]>('get_saved_posts', { p_offset: offset, p_limit: PAGE_SIZE });
export async function getMySavedIds(): Promise<Set<string>> {
  const { data, error } = await supabase.from('saved_posts').select('post_id');
  if (error) throw error;
  return new Set((data ?? []).map((r: { post_id: string }) => r.post_id));
}
export const respondMatch = (id: string, accept: boolean) => rpc<string | null>('respond_match', { p_match: id, p_accept: accept });

/* ---------------- challenges & XP ---------------- */
export const getMyChallenges = () => rpc<ChallengeState>('get_my_challenges');
export const getActiveStrangers = (limit = 6) =>
  rpc<{ unknown_number: number; avatar_seed: string; country_code: string | null; online: boolean }[]>('get_active_strangers', { p_limit: limit });

/* ---------------- notifications ---------------- */
export async function getNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.from('notifications').select('*').order('created_at', { ascending: false }).limit(60);
  if (error) throw error;
  return data as AppNotification[];
}
export async function unreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase.from('notifications').select('id', { count: 'exact', head: true }).is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}
export async function markAllNotificationsRead() {
  await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
}

/* ---------------- storage ---------------- */
export async function uploadPostMedia(localUri: string, kind: 'image' | 'voice', mime: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const ext = kind === 'image' ? (mime.includes('png') ? 'png' : 'jpg') : 'm4a';
  const path = `${u.user.id}/${Crypto.randomUUID()}.${ext}`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from('post-media').upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
  return path;
}

/* ---------------- AI (edge function) ---------------- */
export type AiAction = 'improve' | 'interesting' | 'question' | 'clearer' | 'title' | 'translate' | 'conversation';
/** Calls an Edge Function and turns its JSON `{ error }` into a readable Error code. */
async function invokeFn<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let code = error.message;
    const ctx = (error as { context?: Response }).context;
    try { if (ctx && typeof ctx.json === 'function') code = ((await ctx.json()) as { error?: string }).error ?? code; } catch { /* keep message */ }
    throw new Error(code);
  }
  return data as T;
}
export async function aiAssist(action: AiAction, text: string, extra?: Record<string, string>) {
  return (await invokeFn<{ result: string }>('ai-assist', { action, text, ...extra })).result;
}

/* ---------------- AI characters ---------------- */
export interface AiCharacter {
  id: string; name: string; role: string; tagline: string; bio: string; personality: string; style: string;
  interests: string[]; languages: string[]; starters: string[]; avatar_seed: string; accent: string; sort: number;
  /** optional realistic portrait (https, set by admins in Supabase) — falls back to the bundled illustration */
  portrait_url?: string | null;
}
export interface AiMessage { id: string; role: 'user' | 'assistant'; content: string; created_at: string }
export async function getAiCharacters(): Promise<AiCharacter[]> {
  const { data, error } = await supabase.from('ai_characters').select('*').order('sort');
  if (error) throw error;
  return data as AiCharacter[];
}
export const getMyAiConversations = () =>
  rpc<{ character_id: string; conversation_id: string; updated_at: string; last_message: string | null; last_role: string | null }[]>('get_my_ai_conversations');
export const getAiQuota = () => rpc<{ used: number; msg_limit: number; tier: string }[]>('get_ai_quota').then((r) => r[0] ?? null);
export async function getAiMessages(characterId: string): Promise<AiMessage[]> {
  const { data: conv, error } = await supabase.from('ai_conversations').select('id').eq('character_id', characterId).maybeSingle();
  if (error) throw error;
  if (!conv) return [];
  const { data, error: e2 } = await supabase.from('ai_messages').select('id, role, content, created_at').eq('conversation_id', conv.id).order('created_at').limit(200);
  if (e2) throw e2;
  return data as AiMessage[];
}
/** Sends a message; returns the stored user message + the character's reply. Never fabricates replies. */
export const sendAiMessage = (characterId: string, message: string) =>
  invokeFn<{ conversation_id: string; messages: AiMessage[] }>('ai-chat', { character_id: characterId, message }).then((r) => r.messages);
export async function deleteAiConversation(characterId: string) {
  const { error } = await supabase.from('ai_conversations').delete().eq('character_id', characterId);
  if (error) throw error;
}

/* ---------------- People nearby (coarse, opt-in) ---------------- */
export interface NearbyPerson { unknown_number: number; avatar_seed: string; distance_band: string; city: string | null; country_code: string | null; age: number | null; shared_interests: string[]; interests: string[]; tier: string; online: boolean }
export const getNearbyStatus = () => rpc<{ enabled: boolean; city: string | null; max_radius: number; queries_left: number }[]>('get_nearby_status').then((r) => r[0] ?? null);
export const setNearbyLocation = (lat: number, lng: number, city: string, country: string) =>
  rpc<null>('set_nearby_location', { p_lat: lat, p_lng: lng, p_city: city, p_country: country });
export const disableNearby = () => rpc<null>('disable_nearby');
export const getNearby = (radiusKm: number) => rpc<NearbyPerson[]>('get_nearby', { p_radius_km: radiusKm });

/* ---------------- message reactions ---------------- */
export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥'] as const;
export async function getReactions(messageIds: string[]) {
  if (!messageIds.length) return [] as { message_id: string; user_id: string; emoji: string }[];
  const { data, error } = await supabase.from('message_reactions').select('message_id, user_id, emoji').in('message_id', messageIds.slice(0, 200));
  if (error) throw error;
  return data as { message_id: string; user_id: string; emoji: string }[];
}
export async function setReaction(messageId: string, userId: string, emoji: string | null) {
  if (!emoji) {
    const { error } = await supabase.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('message_reactions').upsert({ message_id: messageId, user_id: userId, emoji });
  if (error) throw error;
}

/* ---------------- nearby social discovery ---------------- */
export type DiscoverScope = 'nearby' | 'world';
export type DiscoverSort = 'distance' | 'active' | 'new' | 'trending' | 'suggested';
export const discoverPeople = (scope: DiscoverScope, radiusKm: number, filters: DiscoverFilters = {}, sort: DiscoverSort = 'distance', excludeSwiped = false, offset = 0, limit = 30) =>
  rpc<PersonCard[]>('discover_people', { p_scope: scope, p_radius_km: radiusKm, p_filters: filters, p_sort: sort, p_exclude_swiped: excludeSwiped, p_offset: offset, p_limit: limit });
export const getPerson = (n: number) => rpc<PersonCard>('get_person', { p_number: n });
export const swipe = (n: number, action: 'like' | 'skip' | 'super') => rpc<{ matched: boolean; conversation_id?: string }>('swipe', { p_number: n, p_action: action });
export const toggleFavorite = (n: number) => rpc<boolean>('toggle_favorite', { p_number: n });
export const getFavorites = () => rpc<PersonCard[]>('get_favorites');
export const getMyLikes = () => rpc<{ count: number; locked: boolean; people: PersonCard[] }>('get_my_likes');
export const getMyVisitors = () => rpc<{ count: number; locked: boolean; people: PersonCard[] }>('get_my_visitors');
export const getMyNearby = () => rpc<{ enabled: boolean; city: string | null; country_code: string | null; updated_at: string | null; expired: boolean }>('get_my_nearby');


/* ---------------- coins, gifts & boosts (all balance changes happen on the server) ---------------- */
export interface Wallet { balance: number; boosted_until: string | null; free_boost_available: boolean; history: { delta: number; reason: string; created_at: string }[] }
export interface Gift { id: string; name: string; emoji: string; price: number }
export const getWallet = () => rpc<Wallet>('get_wallet');
export async function getGiftCatalog(): Promise<Gift[]> {
  const { data, error } = await supabase.from('gift_catalog').select('id, name, emoji, price').order('sort');
  if (error) throw error;
  return data as Gift[];
}
export const sendGift = (number: number, giftId: string) => rpc<{ balance: number; conversation_id: string | null }>('send_gift', { p_number: number, p_gift: giftId });
export const getReceivedGifts = () => rpc<{ total: number; by_gift: { emoji: string; name: string; count: number }[] }>('get_received_gifts');
export const buyBoost = (useFree = false) => rpc<{ boosted_until: string; balance: number }>('buy_boost', { p_use_free: useFree });

/* ---------------- identity verification ---------------- */
export interface VerificationState { verified: boolean; request: { status: 'pending' | 'approved' | 'rejected'; note: string | null; created_at: string } | null }
export const getMyVerification = () => rpc<VerificationState>('get_my_verification');
export async function submitVerification(localUri: string, mime: string, gesture: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const path = `${u.user.id}/${Date.now()}.${mime.includes('png') ? 'png' : 'jpg'}`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from('verifications').upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
  return rpc<{ status: string }>('submit_verification', { p_path: path, p_gesture: gesture });
}

/* ---------------- admin & moderation (server checks profiles.is_admin) ---------------- */
export interface AdminOverview { members: number; active_24h: number; new_7d: number; nearby_on: number; open_reports: number; pending_verifications: number; premium: number; suspended: number }
export interface AdminReport { id: string; type: string; reason: string; details: string | null; status: string; created_at: string; reporter: number | null; target_number: number | null; target_name: string | null; target_status: string | null; target_reports: number; content: string | null }
export interface AdminVerification { id: string; path: string; gesture: string; created_at: string; number: number; name: string | null }
export const adminOverview = () => rpc<AdminOverview>('admin_overview');
export const adminReports = (status: 'open' | 'all' = 'open') => rpc<AdminReport[]>('admin_reports', { p_status: status });
export const adminResolveReport = (id: string, action: 'dismiss' | 'remove_content' | 'suspend_user' | 'ban_user', note?: string) => rpc<void>('admin_resolve_report', { p_report: id, p_action: action, p_note: note ?? null });
export const adminSetUserStatus = (number: number, status: 'active' | 'suspended' | 'banned') => rpc<void>('admin_set_user_status', { p_number: number, p_status: status });
export const adminVerifications = () => rpc<AdminVerification[]>('admin_verifications');
export const adminReviewVerification = (id: string, approve: boolean, note?: string) => rpc<void>('admin_review_verification', { p_id: id, p_approve: approve, p_note: note ?? null });
export const adminLookupUser = (number: number) => rpc<Record<string, unknown> | null>('admin_lookup_user', { p_number: number });
export async function verificationSelfieUrl(path: string) {
  const { data } = await supabase.storage.from('verifications').createSignedUrl(path, 600);
  return data?.signedUrl ?? null;
}

/** Moderators: upload a realistic portrait for a fictional AI character (public bucket, admin-only writes). */
export async function adminUploadCharacterPortrait(id: string, localUri: string, mime: string) {
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${id}-${Date.now()}.${ext}`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from('ai-portraits').upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
  return rpc<string>('admin_set_character_portrait', { p_id: id, p_path: path });
}
export const adminClearCharacterPortrait = (id: string) => rpc<null>('admin_set_character_portrait', { p_id: id, p_path: null });
