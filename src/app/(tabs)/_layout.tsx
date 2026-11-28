import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { TabBar } from '@/components/TabBar';
import { colors } from '@/constants/theme';
import { getInbox } from '@/lib/api';
import { useAuth } from '@/lib/auth';

export default function TabsLayout() {
  const { boot } = useAuth();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    const load = () => getInbox().then((i) => setUnread(i.requests.length + i.conversations.reduce((n, c) => n + c.unread, 0))).catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [boot]);
  return (
    <Tabs tabBar={(p) => <TabBar {...p} badges={{ messages: unread }} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="radar" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
