import { uploadBytes } from '@/lib/media';
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
export interface PersonMeta { photoUrl: string | null; gallery: string[]; tier: Tier; theme: string; name: string | null; verified: boolean }

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
  const { data, error } = await supabase.rpc('get_people_cards', { p_numbers: nums });
  if (error) return;
  const rows = (data ?? []) as { unknown_number: number; display_name: string | null; photo_path: string | null; gallery: string[]; tier: Tier; profile_theme: string; is_verified: boolean }[];
  const urls = await signed(rows.flatMap((r) => [r.photo_path ?? '', ...(r.gallery ?? [])]));
  const now = Date.now();
  for (const n of nums) {
    const r = rows.find((x) => x.unknown_number === n);
    cache.set(n, {
      at: now,
      meta: r
        ? { photoUrl: r.photo_path ? urls.get(r.photo_path) ?? null : null, gallery: (r.gallery ?? []).map((p) => urls.get(p)).filter(Boolean) as string[], tier: r.tier, theme: r.profile_theme, name: r.display_name, verified: r.is_verified }
        : { photoUrl: null, gallery: [], tier: 'free', theme: 'rose', name: null, verified: false },
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
  const up = await uploadBytes(localUri, mime);
  const ext = up.mime.includes('png') ? 'png' : up.mime.includes('webp') ? 'webp' : 'jpg';
  const path = `${id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('avatars').upload(path, up.body, { contentType: up.mime, upsert: false });
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
  await supabase.storage.from('avatars').remove([path]).catch(() => {});  // delete the file too
  invalidateMeta();
}

/** Up to 6 photos in total: the main photo + 5 more. */
export const MAX_PHOTOS = 6;

/** Swap a gallery photo with the main one. */
export async function makeMainPhoto(path: string) {
  const mine = await getMyPhotos();
  const id = await uid();
  if (!mine.gallery.includes(path)) return;
  const gallery = mine.gallery.map((p) => (p === path ? mine.photo_path : p)).filter((p): p is string => !!p);
  const { error } = await supabase.from('profile_private').upsert({ id, photo_path: path, gallery, updated_at: new Date().toISOString() });
  if (error) throw error;
  invalidateMeta();
}

/** Adds a photo: becomes the main photo when there is none yet. */
export async function addPhoto(localUri: string, mime?: string) {
  const mine = await getMyPhotos();
  if ((mine.photo_path ? 1 : 0) + mine.gallery.length >= MAX_PHOTOS) throw new Error('gallery_full');
  if (!mine.photo_path) return setProfilePhoto(localUri, mime);
  return addGalleryPhoto(localUri, mime);
}

/** Deletes the main photo; the first gallery photo (if any) becomes the new main one. */
export async function deleteMainPhoto() {
  const mine = await getMyPhotos();
  const id = await uid();
  const [next, ...rest] = mine.gallery;
  const { error } = await supabase.from('profile_private').upsert({ id, photo_path: next ?? null, gallery: rest, updated_at: new Date().toISOString() });
  if (error) throw error;
  if (mine.photo_path) await supabase.storage.from('avatars').remove([mine.photo_path]).catch(() => {});
  invalidateMeta();
}
