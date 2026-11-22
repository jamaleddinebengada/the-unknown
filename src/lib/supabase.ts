import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False until EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in .env */
export const isSupabaseConfigured = url.startsWith('http') && anonKey.length > 20;

export const supabase = createClient(
  isSupabaseConfigured ? url : 'https://not-configured.supabase.co',
  isSupabaseConfigured ? anonKey : 'not-configured-anon-key-placeholder',
  {
    auth: {
      storage: Platform.OS === 'web' && typeof window === 'undefined' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: Platform.OS === 'web',
      flowType: 'pkce',
    },
  },
);

// Refresh tokens only while the app is in the foreground (Supabase RN guidance).
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}

export const mediaUrl = (path?: string | null) =>
  path ? supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl : undefined;

/** Turns Postgres exception messages from our RPCs into human sentences. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (!isSupabaseConfigured) return 'The community is unreachable right now. Please try again in a moment.';
  if (msg.includes('rate_limited')) return 'You are going a little fast. Take a breath and try again soon.';
  if (msg.includes('daily_limit_reached')) return 'You have used today’s matches. New ones arrive tomorrow — or upgrade for more.';
  if (msg.includes('plus_required')) return 'Saving favorites is part of UNKNOWN PLUS.';
  if (msg.includes('vip_required')) return 'This is a VIP feature.';
  if (msg.includes('super_limit_reached')) return 'You have used today’s 3 Super Connects.';
  if (msg.includes('not_available')) return 'This person is not available right now.';
  if (msg.includes('gallery_full')) return 'Your gallery can hold 6 photos.';
  if (msg.includes('must_be_18')) return 'THE UNKNOWN is for adults 18 and over.';
  if (msg.includes('blocked')) return 'This conversation is no longer available.';
  if (msg.includes('conversation_ended')) return 'This conversation has ended.';
  if (msg.includes('duplicate key') && msg.includes('username')) return 'That username is taken. Try another.';
  if (msg.includes('Invalid login credentials')) return 'Email or password is incorrect.';
  if (msg.includes('Network request failed') || msg.includes('Failed to fetch')) return 'You seem to be offline. Check your connection.';
  if (msg.includes('not_found') || msg.includes('post_not_found')) return 'This is no longer available.';
  return msg.length < 140 ? msg : 'Something went wrong. Please try again.';
}
