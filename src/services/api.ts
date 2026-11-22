import * as Crypto from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import type {
  AppNotification, ChallengeState, Comment, ConversationDetail, ConversationSummary, FeedPost, InterestedUser, Message,
  MatchFilters, MysteryMatch, Person, Plan, Profile, PublicProfile, PostType, Audience,
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
  'onboarding_complete' | 'photo_visibility' | 'profile_theme'>>;

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
export async function sendMessage(conversationId: string, body: string, kind: 'text' | 'prompt' | 'image' | 'voice' = 'text', mediaPath?: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const { error } = await supabase.from('messages').insert({
    conversation_id: conversationId, sender_id: u.user.id, body, kind, media_path: mediaPath ?? null,
  });
  if (error) throw error;
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
export async function aiAssist(action: AiAction, text: string, extra?: Record<string, string>) {
  const { data, error } = await supabase.functions.invoke('ai-assist', { body: { action, text, ...extra } });
  if (error) throw error;
  return (data as { result: string }).result;
}
