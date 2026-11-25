import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming, ZoomIn } from 'react-native-reanimated';
import { ShieldEmblem } from '@/components/Emblem';
import { Screen, StackHeader } from '@/components/Screen';
import { ErrorState, GradientButton, T } from '@/components/ui';
import { colors, fonts, gradients, spacing } from '@/constants/theme';
import { rankOf } from '@/features/challenges/ranks';
import { friendlyError } from '@/lib/supabase';
import { getMyChallenges } from '@/services/api';
import type { ChallengeState } from '@/types/models';


/** Badges are computed from real progress only (level and active days). */
function badgesFor(st: ChallengeState) {
  return [
    { key: 'first', label: 'First steps', icon: '🌱', earned: st.xp > 0 },
    { key: 'l3', label: 'Level 3', icon: '🎯', earned: st.level >= 3 },
    { key: 'l5', label: 'Level 5', icon: '🏅', earned: st.level >= 5 },
    { key: 'l10', label: 'Level 10', icon: '🏆', earned: st.level >= 10 },
    { key: 'week3', label: '3 active days', icon: '🔥', earned: st.active_days >= 3 },
    { key: 'week7', label: 'Perfect week', icon: '💎', earned: st.active_days >= 7 },
    { key: 'today', label: 'All done today', icon: '⭐', earned: st.challenges.length > 0 && st.challenges.every((c) => c.done) },
  ];
}

function Progress({ pct }: { pct: number }) {
  const w = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => { w.set(reduce ? pct : withDelay(250, withTiming(pct, { duration: 900 }))); }, [pct, reduce, w]);
  const a = useAnimatedStyle(() => ({ width: `${Math.max(3, w.value * 100)}%` }));
  return (
    <View style={s.bar}>
      <Animated.View style={[{ height: '100%', borderRadius: 999, overflow: 'hidden' }, a]}>
        <LinearGradient colors={gradients.pill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
      </Animated.View>
    </View>
  );
}

export default function Rewards() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [st, setSt] = useState<ChallengeState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => { getMyChallenges().then((x) => { setSt(x); setError(null); }).catch((e) => setError(friendlyError(e))); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const badges = st ? badgesFor(st) : [];
  const earned = badges.filter((b) => b.earned).length;

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Rewards & Level" />
      {error ? <ErrorState message={error} onRetry={load} /> : !st ? <ActivityIndicator color={colors.violet} style={{ marginTop: 80 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 0 }}>
          <Animated.View entering={ZoomIn.springify().damping(12)} style={{ alignItems: 'center' }}>
            <ShieldEmblem size={170} />
            <Text style={s.level}>Level {st.level}</Text>
            <Text style={s.rank}>{rankOf(st.level)}</Text>
          </Animated.View>
          <View style={{ gap: 6 }}>
            <Progress pct={st.level_xp / st.per_level} />
            <T style={{ textAlign: 'center', fontFamily: fonts.semibold }}>{st.level_xp.toLocaleString()} / {st.per_level.toLocaleString()} XP to level {st.level + 1}</T>
          </View>
          <Animated.View entering={FadeInDown.delay(120).springify()} style={s.stats}>
            {[
              { icon: '🏆', value: st.xp.toLocaleString(), label: 'Points' },
              { icon: '🎖️', value: earned, label: 'Badges' },
              { icon: '🔥', value: `${st.active_days}/7`, label: 'Active days' },
            ].map((x) => (
              <View key={x.label} style={s.stat}>
                <Text style={{ fontSize: 26 }}>{x.icon}</Text>
                <Text style={s.statValue}>{x.value}</Text>
                <T v="caption" color={colors.textMuted}>{x.label}</T>
              </View>
            ))}
          </Animated.View>
          <GradientButton label="Earn more points" arrow onPress={() => router.push('/challenges')} />
          <View style={{ gap: spacing.sm }}>
            <T v="section">Badges</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {badges.map((b, i) => (
                <Animated.View key={b.key} entering={FadeInDown.delay(150 + i * 40)} style={[s.badge, { width: (width - spacing.md * 2 - 20) / 3 }, !b.earned && { opacity: 0.45 }]}>
                  <Text style={{ fontSize: 28 }}>{b.earned ? b.icon : '🔒'}</Text>
                  <T v="caption" style={{ textAlign: 'center', fontFamily: fonts.semibold }}>{b.label}</T>
                </Animated.View>
              ))}
            </View>
          </View>
          <View style={s.note}><Ionicons name="information-circle-outline" size={16} color={colors.textMuted} /><T v="caption" color={colors.textMuted} style={{ flex: 1 }}>Points come from daily challenges: posting, starting conversations, matches and kind replies.</T></View>
        </ScrollView>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  level: { fontFamily: fonts.serif, fontSize: 36, lineHeight: 44, color: colors.plum, marginTop: 4 },
  rank: { fontFamily: fonts.semibold, fontSize: 17, color: colors.textSecondary },
  bar: { height: 14, borderRadius: 999, backgroundColor: '#F1F5F9', overflow: 'hidden' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 14, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  statValue: { fontFamily: fonts.bold, fontSize: 20, color: colors.text },
  badge: { alignItems: 'center', gap: 6, paddingVertical: 14, paddingHorizontal: 6, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  note: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
});
