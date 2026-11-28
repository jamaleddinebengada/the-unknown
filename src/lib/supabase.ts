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

/** Public URL of a profile / activity / post photo (bucket wif-photos). */
export const photoUrl = (path?: string | null) =>
  path ? supabase.storage.from('wif-photos').getPublicUrl(path).data.publicUrl : undefined;

const ERRORS: [string, string][] = [
  ['under_18', 'WhoIsFree is for adults 18 and over.'],
  ['profile_incomplete', 'Finish your profile first (name and date of birth).'],
  ['location_off', 'Turn on your approximate location or choose a city first.'],
  ['location_update_limit', 'You changed your area many times today. Try again tomorrow.'],
  ['invalid_location', 'That location could not be used.'],
  ['invalid_duration', 'Choose a duration between 15 minutes and 24 hours.'],
  ['pick_activity', 'Pick at least one activity.'],
  ['request_limit', 'You sent many requests today. Try again tomorrow.'],
  ['activity_full', 'This activity is full.'],
  ['activity_over', 'This activity is over.'],
  ['already_host', 'You are hosting this activity.'],
  ['invalid_date', 'Choose a date within the next 60 days.'],
  ['not_available', 'This person is not available.'],
  ['account_suspended', 'Your account is suspended. Contact support.'],
  ['no_profile', 'Your profile is not ready yet. Please reopen the app.'],
  ['not_allowed', 'You are not allowed to do this.'],
  ['rate_limited', 'You are going a little fast. Please wait a moment.'],
  ['blocked', 'This conversation is no longer available.'],
  ['camera_denied', 'Allow camera access in your phone settings to take a photo.'],
  ['Invalid login credentials', 'Wrong email or password.'],
  ['Email not confirmed', 'Please confirm your email first — check your inbox.'],
  ['already registered', 'This email already has an account. Sign in instead.'],
  ['Password should be', 'Use a password with at least 8 characters.'],
  ['provider is not enabled', 'This sign-in method is not enabled yet.'],
  ['Could not find the function', 'The WhoIsFree server is not set up yet.'],
  ['does not exist', 'The WhoIsFree server is not set up yet.'],
  ['Network request failed', 'You seem to be offline. Check your connection.'],
  ['Failed to fetch', 'You seem to be offline. Check your connection.'],
  ['not_found', 'This is no longer available.'],
];

/** Turns server error codes into human sentences. */
export function friendlyError(e: unknown): string {
  const msg = (e as { message?: string })?.message ?? String(e);
  if (!isSupabaseConfigured) return 'The server is unreachable right now. Please try again in a moment.';
  const hit = ERRORS.find(([k]) => msg.includes(k));
  if (hit) return hit[1];
  return msg.length < 140 ? msg : 'Something went wrong. Please try again.';
}
