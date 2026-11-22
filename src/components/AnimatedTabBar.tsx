import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { colors, fonts, gradients } from '@/constants/theme';
import { haptic } from '@/utils/format';
import { NotificationBadge } from './ui';

type IconName = keyof typeof Ionicons.glyphMap;
const META: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  discover: { label: 'Discover', icon: 'home-outline', iconOn: 'home' },
  challenges: { label: 'Challenges', icon: 'trophy-outline', iconOn: 'trophy' },
  messages: { label: 'Messages', icon: 'chatbubbles-outline', iconOn: 'chatbubbles' },
  profile: { label: 'Profile', icon: 'person-circle-outline', iconOn: 'person-circle' },
};
const SLOTS = 5; // 4 tabs + the create button in the middle

function TabItem({ name, focused, onPress, badge }: { name: string; focused: boolean; onPress: () => void; badge?: number }) {
  const m = META[name];
  const v = useSharedValue(focused ? 1 : 0);
  useEffect(() => { v.value = withSpring(focused ? 1 : 0, { damping: 15, stiffness: 200 }); }, [focused, v]);
  const icon = useAnimatedStyle(() => ({ transform: [{ translateY: -3 * v.value }, { scale: 1 + 0.12 * v.value }] }));
  const label = useAnimatedStyle(() => ({ opacity: 0.55 + 0.45 * v.value }));
  if (!m) return null;
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={m.label}
      onPress={() => { haptic.tap(); onPress(); }} style={s.item}>
      <Animated.View style={icon}>
        <Ionicons name={focused ? m.iconOn : m.icon} size={23} color={focused ? colors.violetDeep : colors.textMuted} />
        {!!badge && <NotificationBadge count={badge} style={{ position: 'absolute', top: -5, right: -11 }} />}
      </Animated.View>
      <Animated.Text style={[s.label, focused && { color: colors.violetDeep, fontFamily: fonts.semibold }, label]}>{m.label}</Animated.Text>
    </Pressable>
  );
}

function CreateButton() {
  const router = useRouter();
  const sc = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: sc.value }] }));
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Create post" style={s.createWrap}
      onPressIn={() => { sc.set(withTiming(0.9, { duration: 90 })); }} onPressOut={() => { sc.set(withSpring(1, { damping: 8 })); }}
      onPress={() => { haptic.soft(); router.push('/create'); }}>
      <Animated.View style={[s.createShadow, a]}>
        <View style={s.createRing}>
          <LinearGradient colors={gradients.pill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.create}>
            <View style={s.createSheen} />
            <Ionicons name="add" size={30} color={colors.white} />
          </LinearGradient>
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** Floating glass tab bar with a sliding glow indicator and a portal-style create button. */
export function AnimatedTabBar({ state, navigateToTab, insets, badges = {} }: BottomTabBarProps & { badges?: Record<string, number> }) {
  const routes = state.routes.filter((r) => META[r.name]);
  const focusedKey = state.routes[state.index]?.key;
  const focusedIdx = routes.findIndex((r) => r.key === focusedKey);
  const slot = focusedIdx < 2 ? focusedIdx : focusedIdx + 1; // skip the middle create slot
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const slotW = w / SLOTS;
  useEffect(() => { if (w) x.value = withSpring(slot * slotW, { damping: 18, stiffness: 180 }); }, [slot, slotW, w, x]);
  const ind = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  const render = (r: (typeof routes)[number]) => (
    <TabItem key={r.key} name={r.name} focused={r.key === focusedKey} onPress={() => navigateToTab(r.key)} badge={badges[r.name]} />
  );
  return (
    <View pointerEvents="box-none" style={[s.outer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      <View style={s.bar} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {Platform.OS === 'ios' && <BlurView tint="light" intensity={60} style={StyleSheet.absoluteFill} />}
        <LinearGradient colors={['rgba(226,80,138,0.22)', 'rgba(201,151,74,0.12)', 'rgba(255,255,255,0.04)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 28 }]} pointerEvents="none" />
        <LinearGradient colors={['rgba(255,255,255,0.98)', 'rgba(248,246,255,0.98)']} pointerEvents="none"
          style={[StyleSheet.absoluteFill, { margin: 1, borderRadius: 27 }]} />
        {w > 0 && (
          <Animated.View pointerEvents="none" style={[s.indicator, { width: slotW }, ind]}>
            <LinearGradient colors={['rgba(163,40,142,0.18)', 'rgba(163,40,142,0)']} start={{ x: 0.5, y: 1 }} end={{ x: 0.5, y: 0 }} style={s.indicatorGlow} />
            <LinearGradient colors={gradients.pill} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={s.indicatorLine} />
          </Animated.View>
        )}
        <View style={s.row}>
          {routes.slice(0, 2).map(render)}
          <View style={{ flex: 1 }} />
          {routes.slice(2).map(render)}
        </View>
      </View>
      <View pointerEvents="box-none" style={[s.createLayer, { bottom: Math.max(insets.bottom, 12) + 22 }]}>
        <CreateButton />
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  outer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14 },
  bar: { height: 66, borderRadius: 28, overflow: 'hidden', shadowColor: '#7B1E74', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 14 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  label: { fontFamily: fonts.medium, fontSize: 10.5, color: colors.textMuted },
  indicator: { position: 'absolute', bottom: 0, top: 0, alignItems: 'center', justifyContent: 'flex-end' },
  indicatorGlow: { position: 'absolute', bottom: 0, left: 8, right: 8, height: 46, borderRadius: 20 },
  indicatorLine: { width: 26, height: 3, borderRadius: 2, marginBottom: 6 },
  createLayer: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  createWrap: { width: 76, alignItems: 'center' },
  createShadow: { shadowColor: colors.violet, shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 4 }, elevation: 16, borderRadius: 33 },
  createRing: { padding: 4, borderRadius: 40, backgroundColor: colors.white },
  create: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  createSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 24, backgroundColor: 'rgba(255,255,255,0.14)', borderTopLeftRadius: 27, borderTopRightRadius: 27 },
});
