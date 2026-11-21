import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aurora, GlassCard, GlowRing, GradientText, PulseDot, ScreenTitle } from '@/components/Effects';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { PortalMark } from '@/components/Logo';
import { useToast } from '@/components/Overlay';
import { ErrorState, GradientButton, InterestTag, PremiumBadge, PremiumButton, T } from '@/components/ui';
import { interestLabel, MATCH_MODES } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, gradients, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/lib/supabase';
import { findMysteryMatch, getMyMatches, respondMatch } from '@/services/api';
import type { MysteryMatch } from '@/types/models';
import { haptic, unknownName } from '@/utils/format';

function Ring({ value, size = 64 }: { value: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.elevated} strokeWidth={4} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.cyan} strokeWidth={4} fill="none" strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      <T v="bodyStrong" style={{ fontFamily: fonts.bold }}>{value}%</T>
    </View>
  );
}

function Searching() {
  const r = useSharedValue(0);
  useEffect(() => { r.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1); }, [r]);
  const wave = useAnimatedStyle(() => ({ opacity: 1 - r.value, transform: [{ scale: 1 + r.value * 1.4 }] }));
  return (
    <View style={{ alignItems: 'center', gap: spacing.lg, paddingVertical: spacing.xxl }}>
      <View style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View style={[{ position: 'absolute', width: 140, height: 140, borderRadius: 70, borderWidth: 1.5, borderColor: colors.violet }, wave]} />
        <PortalMark size={120} />
      </View>
      <T color={colors.textSecondary}>Searching the world for someone interesting…</T>
    </View>
  );
}

function MatchFace({ m, onAccept, onPass, busy }: { m: MysteryMatch; onAccept: () => void; onPass: () => void; busy: boolean }) {
  const router = useRouter();
  const waiting = m.i_accepted && !m.they_accepted && !m.conversation_id;
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 4, flex: 1 }}>
          <T v="overline" color={colors.cyan}>{m.is_incoming ? 'SOMEONE DISCOVERED YOU' : MATCH_MODES.find((x) => x.key === m.mode)?.label.toUpperCase() ?? 'MYSTERY MATCH'}</T>
          <T v="section" style={{ fontFamily: fonts.extrabold, letterSpacing: 0.6 }}>{unknownName(m.other_number)}</T>
          <T color={colors.textSecondary}>{flagOf(m.other_country)} {m.other_country ? countryName(m.other_country) : 'Somewhere'}{m.other_age ? ` · ${m.other_age} years old` : ''}</T>
        </View>
        <Ring value={m.compatibility} />
      </View>
      <View style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
        <GlowRing size={150} speed={7000} thickness={3}>
          <AnonymousAvatar seed={m.other_avatar_seed} size={124} />
        </GlowRing>
      </View>
      {m.other_tagline && <T v="cardTitle" style={{ textAlign: 'center', fontStyle: 'italic', fontSize: 18 }}>“{m.other_tagline}”</T>}
      <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>{m.shared_interests.length} shared interest{m.shared_interests.length === 1 ? '' : 's'}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {m.shared_interests.map((i) => <InterestTag key={i} accent label={interestLabel(i)} />)}
        {m.other_tags.slice(0, 3).map((t) => <InterestTag key={t} label={t} />)}
      </View>
      <View style={{ marginTop: spacing.sm }}>
        {m.conversation_id ? (
          <GradientButton icon="chatbubbles-outline" label="Open conversation" onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id! } })} />
        ) : waiting ? (
          <View style={{ alignItems: 'center', gap: 8, padding: spacing.sm }}>
            <PulseDot color={colors.cyan} />
            <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>You’re in. When they choose to discover you too, a conversation opens.</T>
          </View>
        ) : m.i_accepted === false ? (
          <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>You passed on this match.</T>
        ) : (
          <View style={{ gap: 8 }}>
            <GradientButton label="START DISCOVERING" icon="sparkles" loading={busy} onPress={onAccept} />
            <PremiumButton tone="ghost" small label="Not this time" onPress={onPass} disabled={busy} />
          </View>
        )}
      </View>
    </View>
  );
}

/** Mystery card: arrives face-down (portal + “?”), flips in 3D to reveal the match. */
function MatchCard(props: { m: MysteryMatch; onAccept: () => void; onPass: () => void; busy: boolean }) {
  const fresh = props.m.i_accepted === null && !props.m.conversation_id;
  const [revealed, setRevealed] = useState(!fresh);
  const [frontGone, setFrontGone] = useState(!fresh);
  const flip = useSharedValue(fresh ? 0 : 1);
  const front = useAnimatedStyle(() => ({ opacity: flip.value < 0.5 ? 1 : 0, transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180}deg` }] }));
  const back = useAnimatedStyle(() => ({ opacity: flip.value >= 0.5 ? 1 : 0, transform: [{ perspective: 1200 }, { rotateY: `${flip.value * 180 - 180}deg` }] }));
  const reveal = () => { haptic.success(); setRevealed(true); flip.value = withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }); setTimeout(() => setFrontGone(true), 950); };
  return (
    <Animated.View entering={ZoomIn.springify().damping(15)}>
      <Animated.View style={back} pointerEvents={revealed ? 'auto' : 'none'}>
        <GlassCard accent={['#38BDF8', '#A855F7']} radius={radius.xl} padding={spacing.lg} glow>
          <MatchFace {...props} />
        </GlassCard>
      </Animated.View>
      {!frontGone ? (
        <Animated.View style={[StyleSheet.absoluteFill, front]} pointerEvents={revealed ? 'none' : 'auto'}>
          <Pressable accessibilityRole="button" accessibilityLabel="Reveal your Mystery Match" onPress={reveal} style={{ flex: 1 }}>
            <LinearGradient colors={['#1B1640', '#2A1F6B', '#0E1A33']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.cardBack}>
              <Aurora variant="warm" stars={16} />
              <GlowRing size={190} speed={4000} thickness={3}>
                <PortalMark size={150} />
              </GlowRing>
              <T v="section" style={{ textAlign: 'center', marginTop: spacing.lg }}>Someone is waiting</T>
              <T color={colors.textSecondary} style={{ textAlign: 'center' }}>{props.m.compatibility}% compatible · {props.m.shared_interests.length} shared interests</T>
              <View style={s.tapHint}><Ionicons name="finger-print" size={16} color={colors.cyan} /><T v="caption" color={colors.cyan} style={{ fontFamily: fonts.semibold }}>Tap to reveal</T></View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export default function Matches() {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState('world');
  const [matches, setMatches] = useState<MysteryMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [none, setNone] = useState(false);

  const load = useCallback(async () => {
    try { setMatches(await getMyMatches()); setError(null); } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const find = async () => {
    setSearching(true); setNone(false);
    const started = Date.now();
    try {
      const m = await findMysteryMatch(mode);
      await new Promise((r) => setTimeout(r, Math.max(0, 1800 - (Date.now() - started))));
      if (m) { haptic.success(); setMatches((p) => [m, ...p]); } else setNone(true);
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setSearching(false); }
  };

  const respond = async (m: MysteryMatch, accept: boolean) => {
    setBusy(m.match_id);
    try {
      const conv = await respondMatch(m.match_id, accept);
      if (conv) { haptic.success(); router.push({ pathname: '/conversation/[id]', params: { id: conv } }); }
      await load();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  const featured = matches.find((m) => !m.conversation_id && m.i_accepted !== false) ?? matches[0];
  const others = matches.filter((m) => m !== featured);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Aurora variant="calm" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.violet} />}>
        <View>
          <ScreenTitle overline="MYSTERY MATCH" title="Someone is waiting" right={profile?.is_premium ? <PremiumBadge /> : undefined} />
          <GradientText text="to discover you." size={Math.min(30, (width - 32) / 9.5)} width={width - 32} colors={['#A78BFA', '#67E8F9']} />
          <T color={colors.textSecondary} style={{ marginTop: 6 }}>{profile?.is_premium ? 'Up to 10 matches a day.' : 'One Mystery Match a day. Identities stay hidden until you both choose otherwise.'}</T>
        </View>
        {loading ? <ActivityIndicator color={colors.violet} /> : error ? <ErrorState message={error} onRetry={load} /> : searching ? <Searching /> : featured ? (
          <MatchCard m={featured} busy={busy === featured.match_id} onAccept={() => respond(featured, true)} onPass={() => respond(featured, false)} />
        ) : null}

        {!searching && (
          <Animated.View entering={FadeIn} style={{ gap: spacing.sm }}>
            <T v="cardTitle">Choose how to meet</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {MATCH_MODES.map((m) => {
                const on = mode === m.key;
                return (
                  <Pressable key={m.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { haptic.tap(); setMode(m.key); }}
                    style={[s.mode, on && s.modeOn]}>
                    {on && <LinearGradient colors={['rgba(109,74,255,0.55)', 'rgba(56,189,248,0.22)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.lg }]} />}
                    <View style={[s.modeIcon, on && { backgroundColor: 'rgba(255,255,255,0.16)' }]}><Ionicons name={m.icon} size={19} color={on ? colors.text : colors.violetSoft} /></View>
                    <T v="bodyStrong" style={{ fontSize: 14 }}>{m.label}</T>
                    <T v="caption" color={on ? colors.text : colors.textMuted} numberOfLines={2}>{m.blurb}</T>
                  </Pressable>
                );
              })}
            </View>
            {none && <T v="caption" color={colors.warning} style={{ textAlign: 'center' }}>No one new fits this mode right now. Try another mode, or come back later.</T>}
            <GradientButton label="Find my Mystery Match" icon="planet-outline" colors={gradients.secondary} onPress={find} style={{ marginTop: spacing.sm }} />
          </Animated.View>
        )}

        {others.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <T v="cardTitle">This week</T>
            {others.map((m, i) => (
              <Animated.View key={m.match_id} entering={FadeInDown.delay(i * 40)}>
                <Pressable onPress={() => m.conversation_id ? router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id } }) : respond(m, true)} style={s.mini}>
                  <AnonymousAvatar seed={m.other_avatar_seed} size={42} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{unknownName(m.other_number)} {flagOf(m.other_country)}</T>
                    <T v="caption" color={colors.textMuted}>
                      {m.conversation_id ? 'Conversation open' : m.i_accepted === false ? 'Passed' : m.i_accepted ? 'Waiting for them' : m.is_incoming ? 'Discovered you — tap to accept' : 'Tap to start discovering'}
                    </T>
                  </View>
                  <T v="caption" color={colors.cyan}>{m.compatibility}%</T>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  mode: { width: '48%', flexGrow: 1, padding: 14, gap: 4, borderRadius: radius.lg, backgroundColor: 'rgba(22,27,43,0.82)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.14)', overflow: 'hidden' },
  modeIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(139,92,246,0.14)', marginBottom: 4 },
  cardBack: { flex: 1, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(167,139,250,0.45)' },
  tapHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.lg, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, backgroundColor: 'rgba(103,232,249,0.1)', borderWidth: 1, borderColor: 'rgba(103,232,249,0.3)' },
  modeOn: { borderColor: 'rgba(167,139,250,0.75)' },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: 'rgba(22,27,43,0.82)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.16)' },
});
