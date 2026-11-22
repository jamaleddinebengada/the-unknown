import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Confetti, ProgressRing } from '@/components/Effects';
import { Scenery } from '@/components/Scenery';
import { ErrorState, T } from '@/components/ui';
import { colors, fonts, gradients, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { getMyChallenges } from '@/services/api';
import type { Challenge, ChallengeState } from '@/types/models';
import { haptic } from '@/utils/format';
import { rankOf } from '@/features/challenges/ranks';

type IconName = keyof typeof Ionicons.glyphMap;
const ROUTE: Record<string, string> = { match: '/discover?view=match', chat: '/messages', post: '/create', interest: '/discover', reply: '/messages', like: '/discover' };
const TINT: Record<string, [string, string]> = {
  post: ['#FFF1D6', '#FF806B'], chat: ['#FFF6D6', '#FF806B'], like: ['#FFE8E2', '#E0466E'], match: ['#FFF1D6', '#E5A800'],
  interest: ['#EAF6FF', '#FFC800'], reply: ['#EAF6FF', '#3F8FB5'],
};

function resetIn() {
  const n = new Date();
  const m = Math.max(0, Math.round((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime()) / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

function Bar({ pct, delay }: { pct: number; delay: number }) {
  const w = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => { w.set(reduce ? pct : withDelay(delay, withTiming(pct, { duration: 700 }))); }, [pct, delay, reduce, w]);
  const a = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={s.bar}>
      <Animated.View style={[{ height: '100%', borderRadius: 999, overflow: 'hidden' }, a]}>
        <LinearGradient colors={gradients.pill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

function Row({ c, i, onPress }: { c: Challenge; i: number; onPress: () => void }) {
  const t = TINT[c.key] ?? ['#FFF8E7', colors.violet];
  return (
    <Animated.View entering={FadeInDown.delay(80 + i * 50).springify().damping(18)}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${c.title}, ${c.xp} XP${c.done ? ', completed' : ''}`} disabled={c.done} onPress={onPress}
        style={({ pressed }) => [s.row, pressed && { transform: [{ scale: 0.985 }] }]}>
        <View style={[s.icon, { backgroundColor: t[0] }]}>
          <Ionicons name={(c.done ? 'checkmark' : c.icon) as IconName} size={20} color={c.done ? colors.success : t[1]} />
        </View>
        <View style={{ flex: 1, gap: 7 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T style={{ flex: 1, fontFamily: fonts.semibold }} numberOfLines={1}>{c.title}</T>
            <View style={s.xp}><Text style={s.xpText}>+{c.xp} XP</Text></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ flex: 1 }}><Bar pct={c.done ? 1 : 0} delay={150 + i * 60} /></View>
            <T v="caption" color={colors.textMuted}>{c.done ? '1/1' : '0/1'}</T>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

function Trophy() {
  const f = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => { if (!reduce) f.set(withRepeat(withSequence(withTiming(1, { duration: 1600 }), withTiming(0, { duration: 1600 })), -1)); }, [f, reduce]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * f.value }] }));
  return <Animated.Text style={[{ fontSize: 96, textAlign: 'center' }, a]}>🏆</Animated.Text>;
}

/** Daily challenges — real progress from the server (resets at midnight UTC). */
export default function Challenges() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [state, setState] = useState<ChallengeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { setState(await getMyChallenges()); setError(null); } catch (e) { setError(friendlyError(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const done = state?.challenges.filter((c) => c.done).length ?? 0;
  const weeklyDone = state?.weekly?.filter((w) => w.progress >= w.target).length ?? 0;
  const [tab, setTab] = useState<'daily' | 'weekly'>('daily');
  const [celebrate, setCelebrate] = useState(0);
  // Reward celebration: when a challenge became complete since the last visit (progress itself comes from the server).
  useEffect(() => {
    if (!state) return;
    const key = 'the-unknown:seen-done-v1';
    const today = new Date().toISOString().slice(0, 10);
    const nowDone = state.challenges.filter((c) => c.done).map((c) => `${today}:${c.key}`);
    AsyncStorage.getItem(key).then((raw) => {
      const seen = new Set<string>(raw ? JSON.parse(raw) : []);
      const fresh = nowDone.filter((k) => !seen.has(k));
      if (fresh.length && seen.size > 0) { setCelebrate((n) => n + 1); haptic.success(); }
      AsyncStorage.setItem(key, JSON.stringify(nowDone)).catch(() => {});
    }).catch(() => {});
  }, [state]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={gradients.mystery} style={StyleSheet.absoluteFill} />
      <Confetti trigger={celebrate} width={width} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, paddingBottom: 0, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.violet} />}>
        <T style={s.title}>Challenges</T>
        {error ? <ErrorState message={error} onRetry={load} /> : !state ? <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} /> : (
          <>
            <Pressable accessibilityRole="button" onPress={() => router.push('/rewards')} style={s.level}>
              <ProgressRing size={60} progress={state.level_xp / state.per_level}><Text style={s.levelNum}>{state.level}</Text></ProgressRing>
              <View style={{ flex: 1, gap: 6 }}>
                <T style={{ fontFamily: fonts.bold }}>Level {state.level} · {rankOf(state.level)}</T>
                <Bar pct={state.level_xp / state.per_level} delay={100} />
                <T v="caption" color={colors.textMuted}>{state.level_xp}/{state.per_level} XP · 🔥 {state.streak ?? 0}-day streak</T>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>

            <View style={s.head}>
              <View style={s.tabs}>
                {(['daily', 'weekly'] as const).map((t) => (
                  <Pressable key={t} accessibilityRole="tab" accessibilityState={{ selected: tab === t }} onPress={() => { haptic.tap(); setTab(t); }} style={[s.tab, tab === t && s.tabOn]}>
                    <Text style={[s.tabText, tab === t && { fontFamily: fonts.extrabold }]}>{t === 'daily' ? 'Daily' : 'Weekly'}</Text>
                  </Pressable>
                ))}
              </View>
              <View style={{ flex: 1 }} />
              <T v="caption" color={colors.textSecondary}>{tab === 'daily' ? `${done}/${state.challenges.length} · resets in ${resetIn()}` : `${weeklyDone}/${state.weekly?.length ?? 0} this week`}</T>
            </View>
            <View style={{ gap: 10 }}>
              {tab === 'daily'
                ? state.challenges.map((c, i) => <Row key={c.key} c={c} i={i} onPress={() => { haptic.tap(); router.push(ROUTE[c.key] as never); }} />)
                : (state.weekly ?? []).map((w, i) => (
                  <Animated.View key={w.key} entering={FadeInDown.delay(60 + i * 50).springify().damping(18)}>
                    <Pressable accessibilityRole="button" onPress={() => { haptic.tap(); router.push(ROUTE[w.key] as never); }} style={s.row}>
                      <ProgressRing size={48} stroke={5} progress={w.progress / w.target}>
                        <Ionicons name={(w.progress >= w.target ? 'checkmark' : w.icon) as IconName} size={18} color={w.progress >= w.target ? colors.success : colors.text} />
                      </ProgressRing>
                      <View style={{ flex: 1, gap: 2 }}>
                        <T style={{ fontFamily: fonts.semibold }}>{w.title}</T>
                        <T v="caption" color={colors.textMuted}>{w.progress}/{w.target}{w.progress >= w.target ? ' · completed' : ''}</T>
                      </View>
                    </Pressable>
                  </Animated.View>
                ))}
            </View>
          </>
        )}
        <View style={{ marginHorizontal: -spacing.md, marginTop: spacing.md, height: 260 }}>
          <Scenery width={width} height={260} flowers="both" style={{ position: 'absolute', top: 0 }} />
          <View style={{ position: 'absolute', left: 0, right: 0, top: 40 }}><Trophy /></View>
        </View>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 30, letterSpacing: -0.8, color: colors.text },
  level: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  levelBadge: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  levelNum: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: 999, backgroundColor: colors.cream },
  tab: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 999 },
  tabOn: { backgroundColor: colors.primary },
  tabText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  head: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  daily: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.primary },
  dailyText: { fontFamily: fonts.bold, fontSize: 14, color: colors.onPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#25324A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  xp: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: '#FFF1D6' },
  xpText: { fontFamily: fonts.bold, fontSize: 12, color: '#7A5600' },
  bar: { height: 8, borderRadius: 999, backgroundColor: '#F1EEE2', overflow: 'hidden' },
});
