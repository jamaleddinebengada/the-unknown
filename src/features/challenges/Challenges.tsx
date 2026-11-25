import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated';
import { GradientText } from '@/components/Effects';
import { EmojiAvatar, Sparkle, Star3D, Trophy } from '@/components/Illustrations3D';
import { Pressy, T } from '@/components/ui';
import { colors, fonts, gradients, radius, spacing } from '@/constants/theme';
import type { Challenge, ChallengeState } from '@/types/models';
import { haptic } from '@/utils/format';

type IconName = keyof typeof import('@expo/vector-icons').Ionicons.glyphMap;

const ROUTE: Record<string, string> = { match: '/discover?view=match', chat: '/messages', post: '/create', interest: '/discover', reply: '/discover', like: '/discover' };
const CARD_COLORS: [string, string][] = [['#168AF7', '#E8B400'], ['#FF5277', '#172339'], ['#168AF7', '#0B6FD1'], ['#F472B6', '#DB2777'], ['#34D399', '#059669'], ['#FBBF24', '#D97706']];

/** Small "Lv 3 · 240 XP" pill for headers. */
export function XpBadge({ state }: { state: ChallengeState | null }) {
  if (!state) return null;
  return (
    <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.xp}>
      <T style={{ fontFamily: fonts.display, fontSize: 12.5, color: '#3B2300' }}>⭐ Lv {state.level} · {state.xp} XP</T>
    </LinearGradient>
  );
}

function ChallengeRow({ c, i, last }: { c: Challenge; i: number; last: boolean }) {
  const router = useRouter();
  const col = CARD_COLORS[i % CARD_COLORS.length];
  return (
    <Animated.View entering={FadeInRight.delay(i * 70).springify().damping(16)} style={{ flexDirection: 'row', gap: 12 }}>
      {/* timeline rail */}
      <View style={{ alignItems: 'center', width: 26 }}>
        <View style={[styles.node, c.done && { backgroundColor: colors.success, borderColor: '#A7F3D0' }]}>
          {c.done ? <Ionicons name="checkmark" size={14} color="#05301F" /> : <View style={styles.nodeDot} />}
        </View>
        {!last && <View style={[styles.rail, c.done && { backgroundColor: 'rgba(52,211,153,0.6)' }]} />}
      </View>
      <Pressy scaleTo={0.97} disabled={c.done} onPress={() => { haptic.tap(); router.push(ROUTE[c.key] as never); }} style={{ flex: 1, marginBottom: spacing.sm }}>
        <LinearGradient colors={c.done ? ['rgba(52,211,153,0.25)', 'rgba(17,22,58,0.9)'] : col} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
          <View pointerEvents="none" style={styles.gloss} />
          <View style={styles.cardIcon}><Ionicons name={c.icon as IconName} size={20} color={colors.text} /></View>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: fonts.display, fontSize: 16 }}>{c.title}</T>
            <T v="caption" color="rgba(255,255,255,0.78)">{c.done ? 'Completed today ✓' : c.subtitle}</T>
          </View>
          <View style={[styles.reward, c.done && { opacity: 0.6 }]}>
            <T style={{ fontFamily: fonts.display, fontSize: 13, color: '#3B2300' }}>+{c.xp}</T>
          </View>
        </LinearGradient>
      </Pressy>
    </Animated.View>
  );
}

/** "Earn points by completing challenges" — the gamified panel from the mockup. */
export function ChallengesPanel({ state }: { state: ChallengeState }) {
  const { width } = useWindowDimensions();
  const done = state.challenges.filter((c) => c.done).length;
  const allDone = done === state.challenges.length;
  const pct = state.level_xp / state.per_level;
  return (
    <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.panel}>
      <LinearGradient colors={['#231E66', '#141A48', '#101540']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Star3D size={30} style={{ position: 'absolute', right: 18, top: 14 }} />
      <Sparkle size={14} delay={300} style={{ position: 'absolute', left: 16, top: 18 }} />
      <View style={{ alignItems: 'center', gap: 2 }}>
        <GradientText text="EARN POINTS" size={Math.min(28, (width - 64) / 7.5)} width={width - 64} align="center" weight={fonts.display} colors={['#0B6FD1', '#168AF7', '#172339']} />
        <GradientText text="BY WINNING CHALLENGES!" size={Math.min(22, (width - 64) / 12)} width={width - 64} align="center" weight={fonts.display} colors={['#0B6FD1', '#172339']} />
        <T v="caption" color={colors.textSecondary}>Complete them every day · {done}/{state.challenges.length} done today</T>
      </View>

      <View style={styles.levelRow}>
        <View style={styles.levelBadge}><T style={{ fontFamily: fonts.display, fontSize: 18, color: '#3B2300' }}>{state.level}</T></View>
        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T style={{ fontFamily: fonts.display, fontSize: 14 }}>Level {state.level}</T>
            <T v="caption" color={colors.textSecondary}>{state.level_xp}/{state.per_level} XP</T>
          </View>
          <View style={styles.bar}>
            <LinearGradient colors={gradients.gold} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.barFill, { width: `${Math.max(4, pct * 100)}%` }]} />
          </View>
        </View>
        <View style={styles.streak}><T style={{ fontFamily: fonts.display, fontSize: 13 }}>🔥 {state.active_days}/7</T></View>
      </View>

      <View style={{ marginTop: spacing.sm }}>
        {state.challenges.map((c, i) => <ChallengeRow key={c.key} c={c} i={i} last={i === state.challenges.length - 1} />)}
      </View>

      {allDone ? (
        <View style={styles.champion}>
          <Trophy size={60} />
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: fonts.display, fontSize: 18 }}>Bravo, champion!</T>
            <T v="caption" color={colors.textSecondary}>Every challenge done today. Come back tomorrow for new ones.</T>
          </View>
          <EmojiAvatar seed="champion" size={40} />
        </View>
      ) : (
        <View style={styles.champion}>
          <Trophy size={48} />
          <T v="caption" color={colors.textSecondary} style={{ flex: 1 }}>Finish all {state.challenges.length} to become today’s champion.</T>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  xp: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' },
  panel: { borderRadius: radius.xl, padding: spacing.lg, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(22,138,247,0.45)', gap: spacing.md },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  levelBadge: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBBF24', borderWidth: 3, borderColor: '#FDE68A' },
  bar: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 5 },
  streak: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: 'rgba(251,113,133,0.18)', borderWidth: 1, borderColor: 'rgba(251,113,133,0.45)' },
  node: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A2F6B', borderWidth: 2, borderColor: 'rgba(22,138,247,0.6)', marginTop: 16 },
  nodeDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.violetSoft },
  rail: { flex: 1, width: 3, marginVertical: 2, borderRadius: 2, backgroundColor: 'rgba(22,138,247,0.35)' },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '45%', backgroundColor: 'rgba(255,255,255,0.1)' },
  cardIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.2)' },
  reward: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: '#FDE68A', borderWidth: 1.5, borderColor: '#FFFFFF' },
  champion: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: 'rgba(251,191,36,0.1)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.4)' },
});
