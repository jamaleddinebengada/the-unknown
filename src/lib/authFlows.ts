import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from './supabase';

export const AUTH_REDIRECT = Linking.createURL('auth-callback');
const consumed = new Set<string>();

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({ email: email.trim().toLowerCase(), password, options: { emailRedirectTo: AUTH_REDIRECT } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}
export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
}
export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo: `${AUTH_REDIRECT}?type=recovery` });
  if (error) throw error;
}
export async function setPassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}
/** Handles whoisfree://auth-callback?code=… (PKCE). */
export async function completeRedirect(url: string): Promise<{ ok: boolean; type: string | null; error?: string }> {
  const q = Linking.parse(url).queryParams ?? {};
  const type = (q.type as string) ?? null;
  if (q.error_description) return { ok: false, type, error: String(q.error_description) };
  try {
    if (typeof q.code === 'string' && !consumed.has(q.code)) {
      consumed.add(q.code);
      const { error } = await supabase.auth.exchangeCodeForSession(q.code);
      if (error) throw error;
    }
    return { ok: true, type };
  } catch (e) { return { ok: false, type, error: (e as Error).message }; }
}
/** Google sign-in (needs the Google provider enabled in Supabase). */
export async function google() {
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true } });
  if (error) throw error;
  if (!data?.url) throw new Error('provider is not enabled');
  const res = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (res.type !== 'success') return false;
  const done = await completeRedirect(res.url);
  if (!done.ok) throw new Error(done.error ?? 'Sign-in failed');
  return true;
}
