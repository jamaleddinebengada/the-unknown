import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/lib/supabase';
import { getMyConversations, unreadNotificationCount } from '@/services/api';

/** Unread counters for the tab bar and header bell, kept live with Supabase Realtime. */
export function useBadges() {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState(0);
  const [messages, setMessages] = useState(0);

  const refresh = useCallback(async () => {
    if (!session) return;
    try {
      const [n, convs] = await Promise.all([unreadNotificationCount(), getMyConversations()]);
      setNotifications(n);
      setMessages(convs.reduce((a, c) => a + (c.archived ? 0 : c.unread), 0));
    } catch { /* offline: keep last known */ }
  }, [session]);

  useFocusEffect(useCallback(() => { refresh(); }, [refresh]));

  useEffect(() => {
    if (!session) return;
    const ch = supabase
      .channel(`badges:${session.user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [session, refresh]);

  return { notifications, messages, refresh };
}
