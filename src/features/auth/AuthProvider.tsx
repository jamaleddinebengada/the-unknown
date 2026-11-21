import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { fetchMyProfile, touchPresence } from '@/services/api';
import type { Profile } from '@/types/models';

interface AuthState {
  ready: boolean;
  session: Session | null;
  profile: Profile | null;
  refreshProfile: () => Promise<Profile | null>;
  /** Local-only flag so returning users skip the intro slides. */
  seenIntro: boolean;
  setSeenIntro: (v: boolean) => void;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [seenIntro, setSeenIntro] = useState(false);

  const refreshProfile = useCallback(async () => {
    try {
      const p = await fetchMyProfile();
      setProfile(p);
      return p;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReady(true);
      return;
    }
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await refreshProfile();
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) refreshProfile();
      else setProfile(null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  // lightweight presence heartbeat for "online" indicators
  useEffect(() => {
    if (!session) return;
    touchPresence().catch(() => {});
    const id = setInterval(() => AppState.currentState === 'active' && touchPresence().catch(() => {}), 120_000);
    return () => clearInterval(id);
  }, [session]);

  const value = useMemo(
    () => ({ ready, session, profile, refreshProfile, seenIntro, setSeenIntro }),
    [ready, session, profile, refreshProfile, seenIntro],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be used inside AuthProvider');
  return v;
}
