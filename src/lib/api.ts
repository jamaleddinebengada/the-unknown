import { supabase } from './supabase';
import { uploadBytes } from './media';
import type { Activity, Availability, Boot, Category, Conversation, Inbox, Message, MyProfile, Notification, Person, Post } from './types';

/** Calls a server function; throws on error. */
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}
export const tz = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; } };

/* ---------- profile ---------- */
export const bootstrap = () => rpc<Boot>('wif_bootstrap');
export const touch = () => rpc<void>('wif_touch');
export type ProfilePatch = Partial<Pick<MyProfile, 'display_name' | 'birth_date' | 'gender' | 'bio' | 'interests' | 'languages' | 'country_code' | 'city' | 'photo_path' | 'gallery' | 'show_age' | 'discoverable' | 'onboarded'>>;
export async function updateProfile(patch: ProfilePatch) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const { error } = await supabase.from('wif_profiles').update(patch).eq('id', u.user.id);
  if (error) throw error;
}
/** Uploads a photo into the member's own folder (bucket wif-photos) and returns its path. */
export async function uploadPhoto(localUri: string, mime = 'image/jpeg', folder = 'p') {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const up = await uploadBytes(localUri, mime);
  const path = `${u.user.id}/${folder}-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('wif-photos').upload(path, up.body, { contentType: up.mime, upsert: false });
  if (error) throw error;
  return path;
}
export const deletePhotoFile = (path: string) => supabase.storage.from('wif-photos').remove([path]).then(() => undefined);

let catCache: Category[] | null = null;
export async function getCategories(): Promise<Category[]> {
  if (catCache) return catCache;
  const { data, error } = await supabase.from('wif_categories').select('*').order('sort');
  if (error) throw error;
  catCache = data as Category[];
  return catCache;
}

/* ---------- location & availability ---------- */
export const setLocation = (lat: number, lng: number, city: string | null, country: string | null) =>
  rpc<void>('wif_set_location', { p_lat: lat, p_lng: lng, p_city: city, p_country: country });
export const disableLocation = () => rpc<void>('wif_disable_location');
export const goFree = (o: { categories: string[]; until: Date; maxKm: number; group: string; budget: string; note?: string; startsAt?: Date }) =>
  rpc<Availability>('wif_go_free', { p_categories: o.categories, p_until: o.until.toISOString(), p_max_km: o.maxKm, p_group: o.group, p_budget: o.budget, p_note: o.note ?? null, p_starts_at: o.startsAt?.toISOString() ?? null });
export const stopFree = () => rpc<void>('wif_stop_free');

/* ---------- discovery ---------- */
export type DiscoverMode = 'free_now' | 'tonight' | 'nearby';
export const discover = (mode: DiscoverMode, o: { radiusKm?: number; category?: string | null; minAge?: number | null; maxAge?: number | null; language?: string | null; offset?: number; limit?: number } = {}) =>
  rpc<Person[]>('wif_discover', { p_mode: mode, p_radius_km: o.radiusKm ?? 10, p_category: o.category ?? null, p_min_age: o.minAge ?? null, p_max_age: o.maxAge ?? null,
    p_language: o.language ?? null, p_group: null, p_tz: tz(), p_offset: o.offset ?? 0, p_limit: o.limit ?? 30 });
export const getPerson = (id: string) => rpc<Person>('wif_get_person', { p_id: id });

/* ---------- requests & chat ---------- */
export const sendRequest = (to: string, message?: string, category?: string | null) =>
  rpc<{ status: 'pending' | 'accepted'; conversation_id?: string }>('wif_send_request', { p_to: to, p_message: message ?? null, p_category: category ?? null });
export const respondRequest = (id: string, accept: boolean) => rpc<{ status: string; conversation_id?: string }>('wif_respond_request', { p_id: id, p_accept: accept });
export const cancelRequest = (id: string) => rpc<void>('wif_cancel_request', { p_id: id });
export const getInbox = () => rpc<Inbox>('wif_inbox');
export const getConversation = (id: string) => rpc<{ id: string; kind: 'direct' | 'group'; title: string | null; activity_id: string | null; members: { id: string; name: string | null; photo_path: string | null }[]; other: Person | null }>('wif_conversation', { p_id: id });
export async function getMessages(conversationId: string, before?: string): Promise<Message[]> {
  let q = supabase.from('wif_messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(40);
  if (before) q = q.lt('created_at', before);
  const { data, error } = await q;
  if (error) throw error;
  return (data as Message[]).reverse();
}
export async function sendMessage(conversationId: string, body: string, image?: { uri: string; mime: string }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  let media_path: string | null = null;
  if (image) {
    const up = await uploadBytes(image.uri, image.mime);
    media_path = `${conversationId}/${Date.now()}.jpg`;
    const { error } = await supabase.storage.from('wif-chat').upload(media_path, up.body, { contentType: up.mime });
    if (error) throw error;
  }
  const { data, error } = await supabase.from('wif_messages').insert({ conversation_id: conversationId, sender_id: u.user.id, kind: image ? 'image' : 'text', body: body.trim() || null, media_path }).select().single();
  if (error) throw error;
  return data as Message;
}
export async function markRead(conversationId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return;
  await supabase.from('wif_members').update({ last_read_at: new Date().toISOString() }).eq('conversation_id', conversationId).eq('user_id', u.user.id);
}
export async function chatImageUrl(path: string) {
  const { data } = await supabase.storage.from('wif-chat').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/* ---------- activities ---------- */
export type ActivityMode = 'nearby' | 'tonight' | 'mine' | 'joined';
export const listActivities = (mode: ActivityMode, o: { category?: string | null; radiusKm?: number; offset?: number } = {}) =>
  rpc<Activity[]>('wif_activities', { p_mode: mode, p_category: o.category ?? null, p_radius_km: o.radiusKm ?? 25, p_tz: tz(), p_offset: o.offset ?? 0, p_limit: 30 });
export const getActivity = (id: string) => rpc<Activity>('wif_get_activity', { p_id: id });
export const createActivity = (o: { category: string; title: string; description?: string; startsAt: Date; endsAt?: Date | null; place: string; max: number; price?: string; cover?: string | null }) =>
  rpc<Activity>('wif_create_activity', { p_category: o.category, p_title: o.title, p_description: o.description ?? null, p_starts_at: o.startsAt.toISOString(),
    p_ends_at: o.endsAt?.toISOString() ?? null, p_place: o.place, p_lat: null, p_lng: null, p_max: o.max, p_price: o.price ?? null, p_cover: o.cover ?? null });
export const joinActivity = (id: string, message?: string) => rpc<string>('wif_join_activity', { p_id: id, p_message: message ?? null });
export const respondJoin = (activity: string, user: string, accept: boolean) => rpc<void>('wif_respond_join', { p_activity: activity, p_user: user, p_accept: accept });
export const leaveActivity = (id: string) => rpc<void>('wif_leave_activity', { p_id: id });
export const surprise = (minutes: number, budget: string, km: number) => rpc<{ activity: Activity | null; people: Person[] }>('wif_surprise', { p_minutes: minutes, p_budget: budget, p_km: km, p_tz: tz() });

/* ---------- moments ---------- */
export const getFeed = (offset = 0) => rpc<Post[]>('wif_feed', { p_offset: offset, p_limit: 20 });
export const createPost = (body: string, media?: string | null) => rpc<string>('wif_create_post', { p_body: body, p_media: media ?? null, p_activity: null });
export const toggleLike = (post: string) => rpc<boolean>('wif_toggle_like', { p_post: post });
export const deletePost = (post: string) => rpc<void>('wif_delete_post', { p_post: post });

/* ---------- notifications ---------- */
export async function getNotifications(): Promise<Notification[]> {
  const { data, error } = await supabase.from('wif_notifications').select('*').order('created_at', { ascending: false }).limit(60);
  if (error) throw error;
  return data as Notification[];
}
export async function markNotificationsRead() {
  await supabase.from('wif_notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
}

/* ---------- safety ---------- */
export const block = (user: string) => rpc<void>('wif_block', { p_user: user });
export const unblock = (user: string) => rpc<void>('wif_unblock', { p_user: user });
export const blockedList = () => rpc<{ id: string; name: string | null; photo_path: string | null }[]>('wif_blocked_list');
export const report = (o: { user?: string | null; reason: string; details?: string; activity?: string | null; post?: string | null }) =>
  rpc<void>('wif_report', { p_user: o.user ?? null, p_reason: o.reason, p_details: o.details ?? null, p_activity: o.activity ?? null, p_post: o.post ?? null });
export const deleteAccount = () => rpc<void>('wif_delete_account');

/* ---------- admin ---------- */
export const adminOverview = () => rpc<Record<string, number>>('wif_admin_overview');
export const adminReports = () => rpc<{ id: string; reason: string; details: string | null; created_at: string; target: { id: string; name: string | null; status: string; photo_path: string | null } | null; reports_on_target: number; activity: string | null; post: string | null }[]>('wif_admin_reports');
export const adminResolve = (id: string, action: 'dismiss' | 'suspend' | 'remove_content' | 'remove_photos') => rpc<void>('wif_admin_resolve', { p_report: id, p_action: action });

export type { Conversation };
