import { supabase } from '@/lib/supabase';

export interface PrivateIdentity { display_name: string | null; social_handle: string | null; about: string | null; photo_path: string | null }

/** The user's own private identity (only revealed via mutual consent). */
export async function getMyIdentity(): Promise<PrivateIdentity | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase.from('profile_private').select('display_name, social_handle, about, photo_path').eq('id', u.user.id).maybeSingle();
  if (error) throw error;
  return data as PrivateIdentity | null;
}

export async function saveMyIdentity(patch: Partial<PrivateIdentity>) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('not_authenticated');
  const { error } = await supabase.from('profile_private').upsert({ id: u.user.id, ...patch, updated_at: new Date().toISOString() });
  if (error) throw error;
}
