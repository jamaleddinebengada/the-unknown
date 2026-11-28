import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { bootstrap, touch } from './api';
import { isSupabaseConfigured, supabase } from './supabase';
import type { Boot } from './types';

interface Ctx {
  ready: boolean;
  session: Session | null;
  boot: Boot | null;
  /** set when the server could not be reached or is not set up */
  bootError: string | null;
  refresh: () => Promise<Boot | null>;
  signOut: () => Promise<void>;
}
const AuthCtx = createContext<Ctx>(null as unknown as Ctx);
export const useAuth = () => useContext(AuthCtx);

/** Email / Google accounts (persisted securely by supabase-js) + the WhoIsFree profile bootstrap. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [boot, setBoot] = useState<Boot | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const b = await bootstrap();
      setBoot(b); setBootError(null);
      return b;
    } catch (e) {
      setBootError((e as Error).message ?? 'error');
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) { setReady(true); return; }
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) await refresh();
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) refresh(); else { setBoot(null); setBootError(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, [refresh]);

  // presence: "online" means active in the last 5 minutes
  useEffect(() => {
    if (!session) return;
    const id = setInterval(() => { if (AppState.currentState === 'active') touch().catch(() => {}); }, 120_000);
    const st = AppState.addEventListener('change', (s) => { if (s === 'active') refresh(); });
    return () => { clearInterval(id); st.remove(); };
  }, [session, refresh]);

  const signOut = useCallback(async () => { await supabase.auth.signOut(); setBoot(null); }, []);
  const value = useMemo(() => ({ ready, session, boot, bootError, refresh, signOut }), [ready, session, boot, bootError, refresh, signOut]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
