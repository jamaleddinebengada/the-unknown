import { Tabs } from 'expo-router/js-tabs';
import { AnimatedTabBar } from '@/components/AnimatedTabBar';
import { colors } from '@/constants/theme';
import { useBadges } from '@/hooks/useBadges';

export default function TabsLayout() {
  const { messages } = useBadges();
  return (
    <Tabs
      tabBar={(props) => <AnimatedTabBar {...props} badges={{ messages }} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.bg } }}>
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="matches" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}

export { AppErrorBoundary as ErrorBoundary } from '@/components/AppErrorBoundary';
