import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

/**
 * Accounts on top of the automatic guest identity.
 *
 * - Every install starts as an anonymous Supabase user (no data typed yet).
 * - "Secure my account" turns that SAME user into a permanent one (email + password, or Google),
 *   so the UNKNOWN #number, chats and matches are kept.
 * - "Sign in" on a new phone replaces the guest session with the existing account.
 * - Links come back to the app through theunknown://auth-callback (PKCE code exchange).
 *   That URL must be listed in Supabase → Authentication → URL Configuration → Redirect URLs.
 */
export const AUTH_REDIRECT = Linking.createURL('auth-callback');

export async function currentUser() {
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

/** Guest → permanent account. Supabase e-mails a confirmation link; the password is set after it. */
export async function secureWithEmail(email: string) {
  const { error } = await supabase.auth.updateUser({ email: email.trim().toLowerCase() }, { emailRedirectTo: AUTH_REDIRECT });
  if (error) throw error;
}

export async function setPassword(password: string) {
  if (password.length < 8) throw new Error('Password should be at least 8 characters');
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

export async function signInWithEmail(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
}

export async function sendPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${AUTH_REDIRECT}?type=recovery` });
  if (error) throw error;
}

const consumed = new Set<string>();

/** Handles theunknown://auth-callback?code=… (PKCE). Returns the link type (e.g. "recovery"). */
export async function completeAuthRedirect(url: string): Promise<{ ok: boolean; type: string | null; error?: string }> {
  const parsed = Linking.parse(url);
  const q = parsed.queryParams ?? {};
  const hash = url.includes('#') ? new URLSearchParams(url.split('#')[1]) : null;
  const type = (q.type as string) ?? hash?.get('type') ?? null;
  const err = (q.error_description as string) ?? hash?.get('error_description') ?? null;
  if (err) return { ok: false, type, error: err };
  try {
    if (typeof q.code === 'string') {
      if (consumed.has(q.code)) return { ok: true, type };  // already handled by the in-app browser flow
      consumed.add(q.code);
      const { error } = await supabase.auth.exchangeCodeForSession(q.code);
      if (error) throw error;
    } else if (hash?.get('access_token') && hash.get('refresh_token')) {
      const { error } = await supabase.auth.setSession({ access_token: hash.get('access_token')!, refresh_token: hash.get('refresh_token')! });
      if (error) throw error;
    }
    return { ok: true, type };
  } catch (e) {
    return { ok: false, type, error: (e as Error).message };
  }
}

/**
 * Google. A guest links Google to the current identity (keeps everything); otherwise it is a normal sign-in.
 * Needs the Google provider enabled in Supabase (and "Allow manual linking" for guests).
 */
export async function continueWithGoogle(linkToGuest: boolean) {
  const opts = { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true };
  const { data, error } = linkToGuest
    ? await supabase.auth.linkIdentity({ provider: 'google', options: opts })
    : await supabase.auth.signInWithOAuth({ provider: 'google', options: opts });
  if (error) throw error;
  if (!data?.url) throw new Error('provider is not enabled');
  const res = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (res.type !== 'success') return false;
  const done = await completeAuthRedirect(res.url);
  if (!done.ok) throw new Error(done.error ?? 'Sign-in failed');
  return true;
}

export async function signOutToGuest() {
  await supabase.auth.signOut();
  await supabase.auth.signInAnonymously();
}
