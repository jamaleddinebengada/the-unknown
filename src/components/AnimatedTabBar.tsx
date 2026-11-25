import { t, type TKey } from '@/i18n';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { colors, fonts } from '@/constants/theme';
import { haptic } from '@/utils/format';
import { NotificationBadge } from './ui';

type IconName = keyof typeof Ionicons.glyphMap;
const META: Record<string, { label: string; icon: IconName; iconOn: IconName }> = {
  nearby: { label: 'Nearby', icon: 'location-outline', iconOn: 'location' },
  discover: { label: 'Discover', icon: 'compass-outline', iconOn: 'compass' },
  matches: { label: 'Matches', icon: 'heart-outline', iconOn: 'heart' },
  messages: { label: 'Messages', icon: 'chatbubble-ellipses-outline', iconOn: 'chatbubble-ellipses' },
  profile: { label: 'Profile', icon: 'person-outline', iconOn: 'person' },
};

function TabItem({ name, focused, onPress, badge }: { name: string; focused: boolean; onPress: () => void; badge?: number }) {
  const m = META[name];
  const v = useSharedValue(focused ? 1 : 0);
  useEffect(() => { v.set(withSpring(focused ? 1 : 0, { damping: 16, stiffness: 220 })); }, [focused, v]);
  const icon = useAnimatedStyle(() => ({ transform: [{ scale: 1 + 0.08 * v.value }] }));
  if (!m) return null;
  const label = t(`tabs.${name}` as TKey);
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={label}
      onPress={() => { haptic.tap(); onPress(); }} style={s.item}>
      <Animated.View style={icon}>
        <Ionicons name={focused ? m.iconOn : m.icon} size={24} color={focused ? colors.primary : colors.textMuted} />
        {!!badge && <NotificationBadge count={badge} style={{ position: 'absolute', top: -5, right: -11 }} />}
      </Animated.View>
      <Animated.Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[s.label, focused && { color: colors.primary, fontFamily: fonts.semibold }]}>{label}</Animated.Text>
    </Pressable>
  );
}

/** Compact docked tab bar with a sliding indicator. */
export function AnimatedTabBar({ state, navigateToTab, insets, badges = {} }: BottomTabBarProps & { badges?: Record<string, number> }) {
  const routes = state.routes.filter((r) => META[r.name]);
  const focusedKey = state.routes[state.index]?.key;
  const idx = Math.max(0, routes.findIndex((r) => r.key === focusedKey));
  const [w, setW] = useState(0);
  const x = useSharedValue(0);
  const slotW = routes.length ? w / routes.length : 0;
  useEffect(() => { if (w) x.set(withSpring(idx * slotW, { damping: 20, stiffness: 200 })); }, [idx, slotW, w, x]);
  const ind = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <View style={s.row} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
        {w > 0 && <Animated.View pointerEvents="none" style={[s.indicator, { width: slotW }, ind]}><View style={s.indicatorLine} /></Animated.View>}
        {routes.map((r) => (
          <TabItem key={r.key} name={r.name} focused={r.key === focusedKey} onPress={() => navigateToTab(r.key)} badge={badges[r.name]} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  bar: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, shadowColor: '#172339', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 12 },
  row: { height: 58, flexDirection: 'row', alignItems: 'center' },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  label: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  indicator: { position: 'absolute', top: 0, alignItems: 'center' },
  indicatorLine: { width: 28, height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: colors.primary },
});
