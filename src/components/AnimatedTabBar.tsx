import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors, fonts, glow, gradients } from '@/constants/theme';
import { haptic } from '@/utils/format';
import { NotificationBadge } from './ui';

type IconName = keyof typeof Ionicons.glyphMap;
const META: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  discover: { label: 'Discover', icon: 'planet-outline', iconOn: 'planet' },
  matches: { label: 'Matches', icon: 'sparkles-outline', iconOn: 'sparkles' },
  messages: { label: 'Messages', icon: 'chatbubbles-outline', iconOn: 'chatbubbles' },
  profile: { label: 'Profile', icon: 'person-circle-outline', iconOn: 'person-circle' },
};

function TabItem({ name, focused, onPress, badge }: { name: string; focused: boolean; onPress: () => void; badge?: number }) {
  const m = META[name];
  const v = useSharedValue(focused ? 1 : 0);
  useEffect(() => { v.value = withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220 }); }, [focused, v]);
  const icon = useAnimatedStyle(() => ({ transform: [{ translateY: -2 * v.value }, { scale: 1 + 0.08 * v.value }] }));
  const dot = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scaleX: 0.4 + 0.6 * v.value }] }));
  if (!m) return null;
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={m.label}
      onPress={() => { haptic.tap(); onPress(); }} style={s.item}>
      <Animated.View style={[icon, focused && glow(colors.violet)]}>
        <Ionicons name={focused ? m.iconOn : m.icon} size={24} color={focused ? colors.violetSoft : colors.textMuted} />
        {!!badge && <NotificationBadge count={badge} style={{ position: 'absolute', top: -4, right: -10 }} />}
      </Animated.View>
      <Text style={[s.label, focused && { color: colors.text }]}>{m.label}</Text>
      <Animated.View style={[s.indicator, dot]} />
    </Pressable>
  );
}

function CreateButton() {
  const router = useRouter();
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Create post" style={s.createWrap}
      onPressIn={() => { sc.set(withTiming(0.92, { duration: 90 })); }} onPressOut={() => { sc.set(withSpring(1)); }}
      onPress={() => { haptic.soft(); router.push('/create'); }}>
      <Animated.View style={[s.create, glow(colors.violetDeep), a]}>
        <LinearGradient colors={gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Ionicons name="add" size={28} color={colors.text} />
      </Animated.View>
    </Pressable>
  );
}

export function AnimatedTabBar({ state, navigateToTab, insets, badges = {} }: BottomTabBarProps & { badges?: Record<string, number> }) {
  const routes = state.routes.filter((r) => META[r.name]);
  const left = routes.slice(0, 2);
  const right = routes.slice(2);
  const focusedKey = state.routes[state.index]?.key;
  const render = (r: (typeof routes)[number]) => (
    <TabItem key={r.key} name={r.name} focused={r.key === focusedKey} onPress={() => navigateToTab(r.key)} badge={badges[r.name]} />
  );
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {Platform.OS === 'ios' ? <BlurView tint="dark" intensity={60} style={StyleSheet.absoluteFill} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: Platform.OS === 'ios' ? 'rgba(9,11,20,0.72)' : 'rgba(9,11,20,0.97)' }]} />
      <View style={s.row}>
        {left.map(render)}
        <CreateButton />
        {right.map(render)}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairlineStrong, overflow: 'visible' },
  row: { flexDirection: 'row', alignItems: 'center', paddingTop: 10 },
  item: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  label: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textMuted },
  indicator: { width: 18, height: 3, borderRadius: 2, backgroundColor: colors.violet, marginTop: 2 },
  createWrap: { width: 72, alignItems: 'center' },
  create: { width: 54, height: 54, borderRadius: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: -18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
});
