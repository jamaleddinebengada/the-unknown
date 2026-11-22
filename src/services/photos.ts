import { supabase } from '@/lib/supabase';

/**
 * Real profile photos.
 * - Files live in the private `avatars` bucket under `<user id>/…`.
 * - Who may see them is decided by the database (`can_see_photo`): the owner chooses
 *   public / only after a mutual identity reveal / hidden. Signed URLs are only issued
 *   when that rule allows it, so the app never sees photos it should not.
 */
export type PhotoVisibility = 'public' | 'revealed' | 'hidden';
export type Tier = 'free' | 'plus' | 'vip';
export interface PersonMeta { photoUrl: string | null; gallery: string[]; tier: Tier; theme: string }

const cache = new Map<number, { meta: PersonMeta; at: number }>();
const listeners = new Set<() => void>();
const TTL = 10 * 60_000;
let queue = new Set<number>();
let timer: ReturnType<typeof setTimeout> | null = null;

async function signed(paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const clean = [...new Set(paths.filter(Boolean))];
  if (!clean.length) return out;
  const { data } = await supabase.storage.from('avatars').createSignedUrls(clean, 3600);
  for (const d of data ?? []) if (d.signedUrl && d.path) out.set(d.path, d.signedUrl);
  return out;
}

async function flush() {
  timer = null;
  const nums = [...queue];
  queue = new Set();
  if (!nums.length) return;
  const { data, error } = await supabase.rpc('get_people_meta', { p_numbers: nums });
  if (error) return;
  const rows = (data ?? []) as { unknown_number: number; photo_path: string | null; gallery: string[]; tier: Tier; profile_theme: string }[];
  const urls = await signed(rows.flatMap((r) => [r.photo_path ?? '', ...(r.gallery ?? [])]));
  const now = Date.now();
  for (const n of nums) {
    const r = rows.find((x) => x.unknown_number === n);
    cache.set(n, {
      at: now,
      meta: r
        ? { photoUrl: r.photo_path ? urls.get(r.photo_path) ?? null : null, gallery: (r.gallery ?? []).map((p) => urls.get(p)).filter(Boolean) as string[], tier: r.tier, theme: r.profile_theme }
        : { photoUrl: null, gallery: [], tier: 'free', theme: 'rose' },
    });
  }
  listeners.forEach((l) => l());
}

/** Batched lookup (one request for every avatar on screen). */
export function requestMeta(n: number) {
  const hit = cache.get(n);
  if (hit && Date.now() - hit.at < TTL) return hit.meta;
  queue.add(n);
  if (!timer) timer = setTimeout(flush, 40);
  return hit?.meta ?? null;
}
export const subscribeMeta = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
export function invalidateMeta(n?: number) {
  if (n == null) cache.clear(); else cache.delete(n);
  listeners.forEach((l) => l());
}

async function uid() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('not_authenticated');
  return data.user.id;
}

async function upload(localUri: string, mime = 'image/jpeg') {
  const id = await uid();
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${id}/${Date.now()}.${ext}`;
  const body = await (await fetch(localUri)).arrayBuffer();
  const { error } = await supabase.storage.from('avatars').upload(path, body, { contentType: mime, upsert: false });
  if (error) throw error;
  return { id, path };
}

export interface MyPhotos { photo_path: string | null; gallery: string[]; photoUrl: string | null; galleryUrls: string[] }

export async function getMyPhotos(): Promise<MyPhotos> {
  const id = await uid();
  const { data, error } = await supabase.from('profile_private').select('photo_path, gallery').eq('id', id).maybeSingle();
  if (error) throw error;
  const photo_path = data?.photo_path ?? null;
  const gallery: string[] = data?.gallery ?? [];
  const urls = await signed([photo_path ?? '', ...gallery]);
  return { photo_path, gallery, photoUrl: photo_path ? urls.get(photo_path) ?? null : null, galleryUrls: gallery.map((p) => urls.get(p) ?? '') };
}

export async function setProfilePhoto(localUri: string, mime?: string) {
  const { id, path } = await upload(localUri, mime);
  const { error } = await supabase.from('profile_private').upsert({ id, photo_path: path, updated_at: new Date().toISOString() });
  if (error) throw error;
  invalidateMeta();
}

export async function removeProfilePhoto() {
  const id = await uid();
  const { error } = await supabase.from('profile_private').upsert({ id, photo_path: null, updated_at: new Date().toISOString() });
  if (error) throw error;
  invalidateMeta();
}

export async function addGalleryPhoto(localUri: string, mime?: string) {
  const mine = await getMyPhotos();
  if (mine.gallery.length >= 6) throw new Error('gallery_full');
  const { id, path } = await upload(localUri, mime);
  const { error } = await supabase.from('profile_private').upsert({ id, gallery: [...mine.gallery, path], updated_at: new Date().toISOString() });
  if (error) throw error;
  invalidateMeta();
}

export async function removeGalleryPhoto(path: string) {
  const mine = await getMyPhotos();
  const id = await uid();
  const { error } = await supabase.from('profile_private').upsert({ id, gallery: mine.gallery.filter((p) => p !== path), updated_at: new Date().toISOString() });
  if (error) throw error;
  invalidateMeta();
}
