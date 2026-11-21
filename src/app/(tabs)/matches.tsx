import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { PortalMark } from '@/components/Logo';
import { useToast } from '@/components/Overlay';
import { BackendNotice, Screen } from '@/components/Screen';
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

function MatchCard({ m, onAccept, onPass, busy }: { m: MysteryMatch; onAccept: () => void; onPass: () => void; busy: boolean }) {
  const router = useRouter();
  const waiting = m.i_accepted && !m.they_accepted && !m.conversation_id;
  return (
    <Animated.View entering={ZoomIn.springify().damping(16)} style={s.match}>
      <LinearGradient colors={['rgba(109,74,255,0.35)', 'rgba(22,27,43,0.2)', 'rgba(56,189,248,0.12)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ gap: 4 }}>
          <T v="overline" color={colors.violetSoft}>{m.is_incoming ? 'SOMEONE DISCOVERED YOU' : MATCH_MODES.find((x) => x.key === m.mode)?.label.toUpperCase() ?? 'MYSTERY MATCH'}</T>
          <T v="section" style={{ fontFamily: fonts.bold, letterSpacing: 0.5 }}>{unknownName(m.other_number)}</T>
          <T color={colors.textSecondary}>{flagOf(m.other_country)} {m.other_country ? countryName(m.other_country) : 'Somewhere'}{m.other_age ? ` · ${m.other_age} years old` : ''}</T>
        </View>
        <Ring value={m.compatibility} />
      </View>
      <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
        <AnonymousAvatar seed={m.other_avatar_seed} size={120} />
      </View>
      {m.other_tagline && <T v="cardTitle" style={{ textAlign: 'center', fontStyle: 'italic' }}>“{m.other_tagline}”</T>}
      <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>{m.shared_interests.length} shared interest{m.shared_interests.length === 1 ? '' : 's'}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        {m.shared_interests.map((i) => <InterestTag key={i} accent label={interestLabel(i)} />)}
        {m.other_tags.slice(0, 3).map((t) => <InterestTag key={t} label={t} />)}
      </View>
      {m.conversation_id ? (
        <GradientButton icon="chatbubbles-outline" label="Open conversation" onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id! } })} />
      ) : waiting ? (
        <View style={{ alignItems: 'center', gap: 6, padding: spacing.sm }}>
          <Ionicons name="hourglass-outline" size={20} color={colors.cyan} />
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
    </Animated.View>
  );
}

export default function Matches() {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuth();
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
    <Screen atmosphere>
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 130 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.violet} />}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <T v="overline" color={colors.violetSoft}>MYSTERY MATCH</T>
            {profile?.is_premium && <PremiumBadge />}
          </View>
          <T v="screenTitle">Someone is waiting to discover you.</T>
          <T color={colors.textSecondary}>{profile?.is_premium ? 'Up to 10 matches a day.' : 'One Mystery Match a day. Identity stays hidden until you both choose otherwise.'}</T>
        </View>
        <BackendNotice />

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
                    <Ionicons name={m.icon} size={20} color={on ? colors.text : colors.violetSoft} />
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
    </Screen>
  );
}

const s = StyleSheet.create({
  match: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.sm, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(139,92,246,0.4)' },
  mode: { width: '48%', flexGrow: 1, padding: 14, gap: 4, borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline },
  modeOn: { backgroundColor: '#211A4A', borderColor: colors.violet },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline },
});
