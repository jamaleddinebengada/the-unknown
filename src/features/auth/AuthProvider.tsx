import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { fetchMyProfile, touchPresence } from '@/services/api';
import type { Profile } from '@/types/models';

const ENTERED_KEY = 'the-unknown:entered-v1';

interface GuestState {
  ready: boolean;
  /** Anonymous guest session (Supabase anonymous sign-in). No email, no password. */
  session: Session | null;
  profile: Profile | null;
  /** True once the person has passed the intro once on this device. */
  entered: boolean;
  enter: () => Promise<void>;
  refreshProfile: () => Promise<Profile | null>;
  /** Drops the current anonymous identity and creates a fresh one. */
  resetIdentity: () => Promise<void>;
}

const Ctx = createContext<GuestState | null>(null);

/** Creates the anonymous identity automatically. The session is persisted in AsyncStorage,
 *  so the same UNKNOWN #number comes back every time the app is reopened. */
async function ensureGuestSession(): Promise<Session | null> {
  if (!isSupabaseConfigured) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: created, error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
  return created.session;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entered, setEntered] = useState(false);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await fetchMyProfile();
      setProfile(p);
      return p;
    } catch {
      return null;
    }
  }, []);

  const boot = useCallback(async () => {
    try {
      const s = await ensureGuestSession();
      setSession(s);
      if (s) await refreshProfile();
    } catch {
      // Offline on first launch: the app still opens; we retry when it comes back to the foreground.
    }
  }, [refreshProfile]);

  useEffect(() => {
    let mounted = true;
    Promise.all([AsyncStorage.getItem(ENTERED_KEY).catch(() => null), boot()]).then(([flag]) => {
      if (!mounted) return;
      setEntered(flag === '1');
      setReady(true);
    });
    if (!isSupabaseConfigured) return () => { mounted = false; };
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) refreshProfile();
      else setProfile(null);
    });
    const appState = AppState.addEventListener('change', (st) => {
      if (st === 'active') supabase.auth.getSession().then(({ data }) => { if (!data.session) boot(); });
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
      appState.remove();
    };
  }, [boot, refreshProfile]);

  // lightweight presence heartbeat for "online" indicators
  useEffect(() => {
    if (!session) return;
    touchPresence().catch(() => {});
    const id = setInterval(() => AppState.currentState === 'active' && touchPresence().catch(() => {}), 120_000);
    return () => clearInterval(id);
  }, [session]);

  const enter = useCallback(async () => {
    setEntered(true);
    await AsyncStorage.setItem(ENTERED_KEY, '1').catch(() => {});
    if (!session) await boot();
  }, [session, boot]);

  const resetIdentity = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    setProfile(null);
    await boot();
  }, [boot]);

  const value = useMemo(
    () => ({ ready, session, profile, entered, enter, refreshProfile, resetIdentity }),
    [ready, session, profile, entered, enter, refreshProfile, resetIdentity],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
