import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aurora } from '@/components/Effects';
import { AvatarStack, EmojiAvatar, GlassShard, GoldTitle, IsoCubes, Sparkle, Star3D, StarRating, StatusPill, Vortex } from '@/components/Illustrations3D';
import { useToast } from '@/components/Overlay';
import { ErrorState, GradientButton, PremiumBadge, PremiumButton, T } from '@/components/ui';
import { interestLabel, MATCH_MODES } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/lib/supabase';
import { findMysteryMatch, getMyChallenges, getMyMatches, respondMatch } from '@/services/api';
import type { MysteryMatch } from '@/types/models';
import { haptic, unknownName } from '@/utils/format';

const TAG_COLORS: [string, string][] = [['#A855F7', '#7C3AED'], ['#38BDF8', '#2563EB'], ['#F472B6', '#DB2777'], ['#34D399', '#059669']];

/** Time left until the next free daily match (the database resets matches at UTC midnight). */
function useNextReset() {
  const calc = () => {
    const n = new Date();
    const next = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1);
    const m = Math.max(0, Math.round((next - n.getTime()) / 60000));
    return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
  };
  const [left, setLeft] = useState(calc);
  useEffect(() => { const t = setInterval(() => setLeft(calc()), 30_000); return () => clearInterval(t); }, []);
  return left;
}

function Hero({ size, searching }: { size: number; searching: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => {
    s.value = searching ? withRepeat(withTiming(1.12, { duration: 500, easing: Easing.inOut(Easing.quad) }), -1, true) : withTiming(1);
  }, [searching, s]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <View style={{ width: '100%', height: size + 20, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={a}><Vortex size={size} /></Animated.View>
      <Star3D size={42} style={{ position: 'absolute', left: '14%', top: size * 0.12 }} />
      <Star3D size={22} tone="violet" delay={500} style={{ position: 'absolute', right: '22%', top: size * 0.04 }} />
      <Star3D size={18} tone="blue" delay={900} style={{ position: 'absolute', left: '22%', bottom: size * 0.16 }} />
      <Sparkle size={18} delay={200} style={{ position: 'absolute', right: '17%', bottom: size * 0.22 }} />
      <Sparkle size={12} color="#C4B5FD" delay={700} style={{ position: 'absolute', left: '30%', top: size * 0.02 }} />
      <GlassShard w={14} h={26} rotate={-25} style={{ left: '27%', top: size * 0.08 }} />
      <GlassShard w={12} h={22} rotate={35} delay={600} style={{ right: '28%', top: size * 0.14 }} />
      <GlassShard w={18} h={12} rotate={10} delay={1200} style={{ left: '20%', top: size * 0.62 }} />
      <GlassShard w={10} h={20} rotate={-40} delay={300} style={{ right: '24%', bottom: size * 0.08 }} />
      <GlassShard w={16} h={10} rotate={60} delay={900} style={{ left: '38%', bottom: 0 }} />
      <Sparkle size={10} color="#FDE68A" delay={400} style={{ position: 'absolute', left: '46%', top: size * 0.35 }} />
      <Sparkle size={9} color="#FDE68A" delay={1000} style={{ position: 'absolute', left: '56%', top: size * 0.58 }} />
      <View style={{ position: 'absolute', left: '3%', top: size * 0.42 }}><EmojiAvatar seed="hero-left-w" gender="woman" size={66} float delay={300} /></View>
      <View style={{ position: 'absolute', right: '3%', top: size * 0.3 }}><EmojiAvatar seed="hero-right-m" gender="man" size={62} float delay={1100} /></View>
    </View>
  );
}

/** Match card from the mockup: stacked glass cards, colourful tags, JOIN button and 3D blocks. */
function MatchCard({ m, onAccept, onPass, busy }: { m: MysteryMatch; onAccept: () => void; onPass: () => void; busy: boolean }) {
  const router = useRouter();
  const waiting = m.i_accepted && !m.they_accepted && !m.conversation_id;
  const tags = [...m.shared_interests.map(interestLabel), ...m.other_tags].slice(0, 3);
  return (
    <Animated.View entering={ZoomIn.springify().damping(15)}>
      <LinearGradient colors={['#FFFFFF', '#F6F3FF', '#EEF4FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.matchCard}>
        <View pointerEvents="none" style={s.cardGloss} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, gap: 4 }}>
            <T v="caption" color={colors.blue} style={{ fontFamily: fonts.display, letterSpacing: 0.8 }}>
              {m.is_incoming ? 'SOMEONE FOUND YOU' : (MATCH_MODES.find((x) => x.key === m.mode)?.label ?? 'Mystery Match').toUpperCase()}
            </T>
            <T style={{ fontFamily: fonts.display, fontSize: 28, lineHeight: 32 }}>UNKNOWN ⭐</T>
            <T style={{ fontFamily: fonts.displaySemi, fontSize: 19, lineHeight: 23, color: colors.textSecondary }}>#{m.other_number} 🚨</T>
            <T v="caption" color={colors.textSecondary}>{flagOf(m.other_country)} {m.other_country ? countryName(m.other_country) : 'Somewhere'}{m.other_age ? ` · ${m.other_age}` : ''} · {m.compatibility}% match</T>
          </View>
          <View style={{ alignItems: 'center', justifyContent: 'center' }}>
            <IsoCubes size={104} />
            <View style={s.alert}><T style={{ fontFamily: fonts.display, fontSize: 14 }} color={colors.white}>!</T></View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing.sm }}>
          {tags.map((t, i) => (
            <View key={t} style={[s.tag, { backgroundColor: TAG_COLORS[i % TAG_COLORS.length][1], borderColor: TAG_COLORS[i % TAG_COLORS.length][0] }]}>
              <T style={s.tagText}>{t.toUpperCase()}</T>
            </View>
          ))}
        </View>
        {m.other_tagline && <T style={{ fontStyle: 'italic', marginTop: spacing.sm }} color={colors.violetSoft}>“{m.other_tagline}”</T>}
        <View style={{ marginTop: spacing.md }}>
          {m.conversation_id ? (
            <GradientButton icon="chatbubbles" label="Open chat" onPress={() => router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id! } })} />
          ) : waiting ? (
            <View style={s.waiting}><Ionicons name="hourglass" size={18} color={colors.cyan} /><T v="caption" color={colors.textSecondary} style={{ flex: 1 }}>You joined. When they join too, your chat opens.</T></View>
          ) : m.i_accepted === false ? (
            <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>You passed on this match.</T>
          ) : (
            <View style={{ gap: 6 }}>
              <GradientButton label="Join" loading={busy} onPress={onAccept} />
              <PremiumButton tone="ghost" small label="Not this time" onPress={onPass} disabled={busy} />
            </View>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

export default function Matches() {
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuth();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const nextReset = useNextReset();
  const [mode, setMode] = useState('world');
  const [matches, setMatches] = useState<MysteryMatch[]>([]);
  const [usedToday, setUsedToday] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [none, setNone] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, ch] = await Promise.all([getMyMatches(), getMyChallenges().catch(() => null)]);
      setMatches(m);
      if (ch) setUsedToday(ch.matched_today);
      setError(null);
    } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const find = async () => {
    setSearching(true); setNone(false);
    const started = Date.now();
    try {
      const m = await findMysteryMatch(mode);
      await new Promise((r) => setTimeout(r, Math.max(0, 2200 - (Date.now() - started))));
      if (m) { haptic.success(); setMatches((p) => [m, ...p]); setUsedToday(true); } else setNone(true);
    } catch (e) {
      if (String((e as Error)?.message).includes('daily_limit_reached')) setUsedToday(true);
      toast(friendlyError(e), 'error');
    } finally { setSearching(false); }
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
  const titleSize = Math.min(34, (width - 40) / 9.2);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Aurora variant="warm" stars={30} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.md, gap: spacing.md, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.violet} />}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <StatusPill label={searching ? 'SEARCHING THE WORLD…' : 'THE UNKNOWN · ACTIVE'} />
            {profile?.is_premium && <PremiumBadge />}
          </View>
          <GoldTitle lines={['DISCOVERY MODE', 'ACTIVATED']} size={titleSize} width={width - 32} />
        </View>

        <Hero size={Math.min(230, width * 0.58)} searching={searching} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {MATCH_MODES.map((m) => {
            const on = mode === m.key;
            return (
              <Pressable key={m.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { haptic.tap(); setMode(m.key); }}
                style={[s.mode, on && s.modeOn]}>
                {on && <LinearGradient colors={['#7C6CFF', '#5B4BF0']} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />}
                <Ionicons name={m.icon} size={15} color={on ? colors.white : colors.violet} />
                <T style={{ fontFamily: fonts.displaySemi, fontSize: 14 }} color={on ? colors.white : colors.textSecondary}>{m.label}</T>
              </Pressable>
            );
          })}
        </ScrollView>

        <GradientButton label={searching ? 'Searching…' : 'Find a stranger'} icon="planet" loading={searching} onPress={find} />
        {none && <T v="caption" color={colors.warning} style={{ textAlign: 'center' }}>No one new fits this mode right now. Try another mode.</T>}
        {usedToday && !profile?.is_premium && (
          <Pressable onPress={() => router.push('/premium')} style={s.upsell}>
            <Ionicons name="diamond" size={18} color="#D97706" />
            <T style={{ fontFamily: fonts.displaySemi, fontSize: 14, flex: 1 }}>Want more today? UNKNOWN PLUS gives you 10 matches a day.</T>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </Pressable>
        )}

        <View style={s.timer}>
          <View style={s.timerIcon}><Ionicons name="stopwatch" size={22} color={colors.white} /></View>
          <View style={{ flex: 1, gap: 2 }}>
            <T style={{ fontFamily: fonts.display, fontSize: 16 }}>{usedToday && !profile?.is_premium ? `Next match in ${nextReset}` : 'Your match is ready'}</T>
            <StarRating value={Math.min(5, matches.length)} />
          </View>
          <AvatarStack seeds={matches.length ? matches.slice(0, 3).map((m) => m.other_avatar_seed) : ['a1', 'b2', 'c3']} />
        </View>

        {loading ? <ActivityIndicator color={colors.violet} /> : error ? <ErrorState message={error} onRetry={load} /> : featured ? (
          <MatchCard m={featured} busy={busy === featured.match_id} onAccept={() => respond(featured, true)} onPass={() => respond(featured, false)} />
        ) : (
          <Animated.View entering={FadeIn} style={s.emptyCard}>
            <T style={{ fontFamily: fonts.display, fontSize: 18, textAlign: 'center' }}>Your next stranger is out there</T>
            <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>Pick a mode and tap Find a stranger. Identities stay hidden until you both choose otherwise.</T>
          </Animated.View>
        )}

        <View style={s.trust}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={s.check}><Ionicons name="checkmark" size={12} color="#05301F" /></View>
            <T style={{ fontFamily: fonts.displaySemi, fontSize: 13 }} color={colors.textSecondary}>100% anonymous</T>
          </View>
          <T style={{ fontFamily: fonts.displaySemi, fontSize: 13 }} color={colors.textSecondary}>⭐ {matches.length} this week</T>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AvatarStack seeds={['t1', 't2', 't3']} size={24} />
            <View style={s.plus}><Ionicons name="add" size={13} color={colors.white} /></View>
          </View>
        </View>

        {others.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <T style={{ fontFamily: fonts.display, fontSize: 18 }}>This week</T>
            {others.map((m, i) => (
              <Animated.View key={m.match_id} entering={FadeInDown.delay(i * 40)}>
                <Pressable onPress={() => (m.conversation_id ? router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id } }) : respond(m, true))} style={s.mini}>
                  <EmojiAvatar seed={m.other_avatar_seed} size={42} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: fonts.displaySemi, fontSize: 15 }}>{unknownName(m.other_number)} {flagOf(m.other_country)}</T>
                    <T v="caption" color={colors.textMuted}>
                      {m.conversation_id ? 'Chat open' : m.i_accepted === false ? 'Passed' : m.i_accepted ? 'Waiting for them' : m.is_incoming ? 'Found you — tap to join' : 'Tap to join'}
                    </T>
                  </View>
                  <View style={s.pct}><T style={{ fontFamily: fonts.display, fontSize: 13 }}>{m.compatibility}%</T></View>
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
  mode: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder, overflow: 'hidden' },
  modeOn: { borderColor: 'rgba(255,255,255,0.35)' },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#4C3FB8', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  timerIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: '#5B4BF0', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  alert: { position: 'absolute', top: -2, right: -2, width: 24, height: 24, borderRadius: 12, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  trust: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, paddingHorizontal: 4 },
  check: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  plus: { width: 24, height: 24, borderRadius: 12, marginLeft: -6, backgroundColor: '#7C3AED', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  matchCard: { borderRadius: 28, padding: spacing.lg, borderWidth: 1.5, borderColor: 'rgba(124,108,255,0.25)', overflow: 'hidden', shadowColor: '#6C5CFF', shadowOpacity: 0.18, shadowRadius: 20, elevation: 10 },
  cardGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: 70, backgroundColor: 'rgba(255,255,255,0.5)' },
  tag: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1.5 },
  tagText: { fontFamily: fonts.display, fontSize: 12.5, letterSpacing: 0.6, color: colors.white },
  waiting: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: 'rgba(56,189,248,0.08)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.3)' },
  emptyCard: { gap: 8, padding: spacing.lg, borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: 'rgba(251,191,36,0.12)', borderWidth: 1, borderColor: 'rgba(217,119,6,0.35)' },
  pct: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(56,189,248,0.12)', borderWidth: 1, borderColor: 'rgba(56,189,248,0.4)' },
});
