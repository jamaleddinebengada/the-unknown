import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/constants/theme';
import { t, type TKey } from '@/i18n';
import { haptic } from '@/utils/format';

type IconName = keyof typeof Ionicons.glyphMap;
const META: Record<string, [IconName, IconName]> = {
  home: ['home-outline', 'home'],
  radar: ['radio-outline', 'radio'],
  messages: ['chatbubbles-outline', 'chatbubbles'],
  profile: ['person-outline', 'person'],
};

function Item({ name, focused, onPress, badge }: { name: string; focused: boolean; onPress: () => void; badge?: number }) {
  const v = useSharedValue(focused ? 1 : 0);
  useEffect(() => { v.set(withSpring(focused ? 1 : 0, { damping: 15, stiffness: 220 })); }, [focused, v]);
  const pill = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scaleX: 0.6 + 0.4 * v.value }] }));
  const [off, on] = META[name];
  return (
    <Pressable accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={t(`tabs.${name}` as TKey)}
      onPress={() => { haptic.tap(); onPress(); }} style={s.item}>
      <View>
        <Animated.View style={[s.pill, pill]} />
        <Ionicons name={focused ? on : off} size={23} color={colors.text} style={{ marginHorizontal: 14, marginVertical: 4 }} />
        {!!badge && <View style={s.badge}><Text style={s.badgeText}>{badge > 9 ? '9+' : badge}</Text></View>}
      </View>
      <Text style={[s.label, focused && { fontFamily: fonts.bold, color: colors.text }]} numberOfLines={1}>{t(`tabs.${name}` as TKey)}</Text>
    </Pressable>
  );
}

/** Home · Radar · (Create) · Messages · Profile — the centre button opens the create menu. */
export function TabBar({ state, navigateToTab, badges }: BottomTabBarProps & { badges?: Record<string, number> }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const routes = state.routes.filter((r) => META[r.name]);
  const render = (r: (typeof routes)[number]) => {
    const i = state.routes.indexOf(r);
    return <Item key={r.key} name={r.name} focused={state.index === i} badge={badges?.[r.name]} onPress={() => navigateToTab(r.key)} />;
  };
  return (
    <View style={[s.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      {routes.slice(0, 2).map(render)}
      <Pressable onPress={() => { haptic.soft(); router.push('/create'); }} accessibilityRole="button" accessibilityLabel={t('tabs.create')} style={s.item}>
        <View style={s.create}><Ionicons name="add" size={30} color={colors.text} /></View>
      </Pressable>
      {routes.slice(2).map(render)}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', paddingTop: 8, backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  item: { flex: 1, alignItems: 'center', gap: 2 },
  pill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: 16, backgroundColor: colors.primary },
  label: { fontFamily: fonts.medium, fontSize: 11, color: colors.textMuted },
  create: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: -26, borderWidth: 4, borderColor: colors.white, shadowColor: '#C9A800', shadowOpacity: 0.5, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
  badge: { position: 'absolute', right: 6, top: -2, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.white },
  badgeText: { fontFamily: fonts.bold, fontSize: 9.5, color: '#fff' },
});
