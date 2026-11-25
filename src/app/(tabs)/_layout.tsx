import { Tabs } from 'expo-router/js-tabs';
import { AnimatedTabBar } from '@/components/AnimatedTabBar';
import { colors } from '@/constants/theme';
import { useEffect } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { useBadges } from '@/hooks/useBadges';
import { registerForPush } from '@/services/push';

export default function TabsLayout() {
  const { messages } = useBadges();
  const { session } = useAuth();
  // ask for notification permission only once the person is inside the app (after onboarding)
  useEffect(() => { if (session) { const id = setTimeout(() => registerForPush(session.user.id), 4000); return () => clearTimeout(id); } }, [session]);
  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} badges={{ messages }} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="nearby" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="matches" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
