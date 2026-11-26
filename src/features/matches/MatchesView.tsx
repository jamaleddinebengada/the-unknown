import { PersonName } from '@/hooks/usePersonMeta';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing, FadeIn, FadeInDown, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withSpring, withTiming, ZoomIn,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { MaskLogo } from '@/components/Brand';
import { DiscoveryRings } from '@/components/Effects';
import { BottomSheet, useToast } from '@/components/Overlay';
import { ErrorState, GradientButton, PremiumBadge, T } from '@/components/ui';
import { interestLabel, MATCH_MODES } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, gradients, radius, spacing } from '@/constants/theme';
import { refreshPlan, TIER_LABEL, usePlan } from '@/features/membership/usePlan';
import { usePersonMeta } from '@/hooks/usePersonMeta';
import { friendlyError } from '@/lib/supabase';
import { findMysteryMatch, getMyMatches, getMySuperMatchIds, respondMatch, superConnect } from '@/services/api';
import type { MatchFilters, MysteryMatch } from '@/types/models';
import { haptic } from '@/utils/format';

const FILTER_COUNTRIES = ['MA', 'FR', 'ES', 'US', 'GB', 'DE', 'IT', 'AE', 'SA', 'EG', 'TR', 'CA', 'BE', 'NL', 'BR', 'JP'];
const AGE_RANGES: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Any age', min: null, max: null }, { label: '18–24', min: 18, max: 24 }, { label: '25–34', min: 25, max: 34 },
  { label: '35–44', min: 35, max: 44 }, { label: '45+', min: 45, max: null },
];
const SWIPE = 110;

/** The big Mystery Match card: real photo when the person allows it, otherwise the mask + "?". */
function MatchCardFace({ m, width, isSuper }: { m: MysteryMatch | null; width: number; isSuper: boolean }) {
  const meta = usePersonMeta(m?.other_number);
  const photo = meta?.photoUrl;
  const h = width * 1.22;
  const pulse = useSharedValue(0);
  const reduce = useReducedMotion();
  useFocusEffect(useCallback(() => {
    if (!reduce) pulse.set(withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 1400 })), -1));
  }, [pulse, reduce]));
  const q = useAnimatedStyle(() => ({ transform: [{ scale: 1 + pulse.value * 0.06 }] }));
  return (
    <View style={[s.face, { width, height: h }]}>
      {photo ? (
        <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} accessibilityLabel="Profile photo" />
      ) : (
        <LinearGradient colors={['#EAF5FF', '#3BA0FF', '#168AF7']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <View style={s.faceGlow} />
          <View style={{ marginTop: m ? -70 : 0 }}><MaskLogo size={width * 0.55} tone="ink" /></View>
          {!m && <T style={{ fontFamily: fonts.serifItalic, fontSize: 18, marginTop: 14 }} color={colors.text}>Who will you meet today?</T>}
        </LinearGradient>
      )}
      <View pointerEvents="none" style={s.faceSheen} />
      {m && (
        <View style={s.faceInfo}>
          {isSuper && <View style={s.superTag}><Ionicons name="star" size={12} color="#5A4100" /><Text style={s.superText}>SUPER CONNECT</Text></View>}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.faceName}><PersonName number={m.other_number} /></Text>
            {meta && meta.tier !== 'free' && <PremiumBadge label={TIER_LABEL[meta.tier].toUpperCase()} />}
          </View>
          <Text style={s.faceMeta}>
            {flagOf(m.other_country)} {m.other_country ? countryName(m.other_country) : 'Somewhere'}{m.other_age ? ` · ${m.other_age}` : ''} · {m.compatibility}% match
          </Text>
          {m.is_incoming && <Text style={[s.faceMeta, { color: colors.coral, fontFamily: fonts.semibold }]}>Someone found you</Text>}
        </View>
      )}
      <Animated.View style={[s.qBadge, { left: width / 2 - 34, bottom: m ? 104 : 26 }, q]}>
        <LinearGradient colors={gradients.pill} style={s.qInner}><Text style={s.qText}>?</Text></LinearGradient>
      </Animated.View>
    </View>
  );
}

function RoundAction({ icon, colors: g, onPress, label, size = 64, iconColor = colors.white, disabled }: {
  icon: keyof typeof Ionicons.glyphMap; colors: readonly [string, string, ...string[]]; onPress: () => void; label: string; size?: number; iconColor?: string; disabled?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={() => { haptic.soft(); onPress(); }}
      style={({ pressed }) => [{ opacity: disabled ? 0.45 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] }]}>
      <LinearGradient colors={g} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[s.round, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name={icon} size={size * 0.44} color={iconColor} />
      </LinearGradient>
    </Pressable>
  );
}

/** Mystery Match — shown inside the Discover page ("Mystery Match" view). `top` is the shared page header. */
export function MatchesView({ top }: { top?: ReactNode }) {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const plan = usePlan();
  const reduce = useReducedMotion();
  const [mode, setMode] = useState('world');
  const [filters, setFilters] = useState<MatchFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  const [matches, setMatches] = useState<MysteryMatch[]>([]);
  const [supers, setSupers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [none, setNone] = useState(false);

  const load = useCallback(async () => {
    try {
      const [m, sup] = await Promise.all([getMyMatches(), getMySuperMatchIds().catch(() => new Set<string>())]);
      setMatches(m); setSupers(sup); setError(null);
    } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const pending = matches.filter((m) => !m.conversation_id && m.i_accepted == null);
  const featured = pending[0] ?? null;
  const waiting = matches.filter((m) => !m.conversation_id && m.i_accepted && !m.they_accepted);
  const others = matches.filter((m) => m !== featured);
  const paid = plan && plan.tier !== 'free';
  const left = plan ? Math.max(0, plan.match_limit - plan.matches_today) : null;
  const cardW = Math.min(width - 72, 340);

  const find = async () => {
    if (left === 0) { toast(plan?.tier === 'vip' ? 'You used all of today’s matches.' : 'Today’s matches are used. Upgrade for more.'); if (plan?.tier !== 'vip') router.push('/premium'); return; }
    setSearching(true); setNone(false);
    const started = Date.now();
    try {
      const m = await findMysteryMatch(mode, paid ? filters : {});
      await new Promise((r) => setTimeout(r, Math.max(0, (reduce ? 400 : 1800) - (Date.now() - started))));
      if (m) { haptic.success(); setMatches((p) => [m, ...p]); } else setNone(true);
      refreshPlan();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setSearching(false); }
  };

  const act = async (kind: 'pass' | 'join' | 'super') => {
    if (!featured || busy) return;
    if (kind === 'super' && plan?.tier !== 'vip') { toast('Super Connect is a VIP feature.'); router.push('/premium'); return; }
    setBusy(true);
    try {
      const conv = kind === 'super' ? await superConnect(featured.match_id) : await respondMatch(featured.match_id, kind === 'join');
      if (kind !== 'pass') haptic.success();
      if (conv) router.push({ pathname: '/conversation/[id]', params: { id: conv } });
      else if (kind !== 'pass') toast(kind === 'super' ? 'Super Connect sent ⭐ They will see you stand out.' : 'You joined. When they join too, your chat opens.', 'success');
      await load(); refreshPlan();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  // 3D-inspired swipe: drag right to join, left to pass.
  const x = useSharedValue(0);
  const pan = Gesture.Pan().enabled(!!featured && !busy).activeOffsetX([-12, 12])
    .onUpdate((e) => { x.value = e.translationX; })
    .onEnd((e) => {
      if (e.translationX > SWIPE) { x.value = withTiming(600, { duration: 220 }, () => { x.value = 0; }); scheduleOnRN(act, 'join'); }
      else if (e.translationX < -SWIPE) { x.value = withTiming(-600, { duration: 220 }, () => { x.value = 0; }); scheduleOnRN(act, 'pass'); }
      else x.value = withSpring(0, { damping: 14 });
    });
  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { perspective: 900 },
      { translateX: x.value },
      { rotateZ: `${interpolate(x.value, [-300, 300], [-12, 12])}deg` },
      { rotateY: `${interpolate(x.value, [-300, 300], [18, -18])}deg` },
    ],
  }));
  const likeHint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, SWIPE], [0, 1], 'clamp') }));
  const passHint = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-SWIPE, -20], [1, 0], 'clamp') }));

  const filterLabel = [filters.country ? `${flagOf(filters.country)} ${countryName(filters.country)}` : null, AGE_RANGES.find((a) => a.min === (filters.minAge ?? null) && a.max === (filters.maxAge ?? null) && a.min != null)?.label].filter(Boolean).join(' · ');

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ paddingTop: top ? 0 : insets.top + spacing.sm, paddingHorizontal: spacing.md, gap: spacing.md, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.violet} />}>
        {top && <View style={{ marginHorizontal: -spacing.md }}>{top}</View>}

        <View style={{ alignItems: 'center', gap: 2 }}>
          <Text style={s.title}>Mystery Match</Text>
          <T color={colors.textSecondary} style={{ textAlign: 'center' }}>Meet someone new based on your interests.</T>
          {plan && (
            <T v="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
              {plan.matches_today}/{plan.match_limit} matches today{plan.tier === 'vip' ? ` · ${plan.super_limit - plan.supers_today} Super Connects left` : ''}
            </T>
          )}
        </View>

        {loading ? <ActivityIndicator color={colors.violet} style={{ marginVertical: 60 }} /> : error ? <ErrorState message={error} onRetry={load} /> : (
          <View style={{ alignItems: 'center' }}>
            <DiscoveryRings size={cardW * 1.9} style={{ top: cardW * 0.61 - cardW * 0.95 }} />
            {/* stacked cards behind */}
            <View style={[s.behind, { width: cardW, height: cardW * 1.22, transform: [{ rotate: '-7deg' }, { translateX: -14 }] }]} />
            <View style={[s.behind, { width: cardW, height: cardW * 1.22, transform: [{ rotate: '6deg' }, { translateX: 14 }], backgroundColor: '#EAF5FF' }]} />
            <GestureDetector gesture={pan}>
              <Animated.View entering={ZoomIn.springify().damping(15)} key={featured?.match_id ?? 'empty'} style={[s.cardShadow, cardStyle]}>
                <MatchCardFace m={featured} width={cardW} isSuper={!!featured && supers.has(featured.match_id)} />
                <Animated.View style={[s.hint, { left: 18, borderColor: colors.success }, likeHint]}><Text style={[s.hintText, { color: colors.success }]}>JOIN</Text></Animated.View>
                <Animated.View style={[s.hint, { right: 18, borderColor: colors.danger }, passHint]}><Text style={[s.hintText, { color: colors.danger }]}>PASS</Text></Animated.View>
              </Animated.View>
            </GestureDetector>
          </View>
        )}

        {featured ? (
          <Animated.View entering={FadeInDown} style={{ gap: spacing.md }}>
            {featured.shared_interests.length + featured.other_tags.length > 0 && (
              <View style={s.chips}>
                {[...featured.shared_interests.map(interestLabel), ...featured.other_tags].slice(0, 4).map((t) => (
                  <View key={t} style={s.chip}><Text style={s.chipText}>{t}</Text></View>
                ))}
              </View>
            )}
            <View style={s.actions}>
              <RoundAction label="Pass" icon="close" colors={['#FFFFFF', '#F8FAFC']} iconColor={colors.violetDeep} onPress={() => act('pass')} disabled={busy} />
              <RoundAction label="Super Connect (VIP)" icon="star" size={56} colors={gradients.gold} iconColor="#5A4100" onPress={() => act('super')} disabled={busy} />
              <RoundAction label="Join" icon="heart" colors={gradients.rose} onPress={() => act('join')} disabled={busy} />
            </View>
            <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>Swipe right to join, left to pass. The chat opens when you both join.</T>
          </Animated.View>
        ) : (
          <View style={{ gap: spacing.md }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {MATCH_MODES.map((m) => {
                const on = mode === m.key;
                return (
                  <Pressable key={m.key} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { haptic.tap(); setMode(m.key); }} style={[s.mode, on && s.modeOn]}>
                    <Ionicons name={m.icon} size={15} color={on ? colors.onPrimary : colors.coral} />
                    <Text style={[s.modeText, on && { color: colors.onPrimary, fontFamily: fonts.bold }]}>{m.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => (paid ? setFilterOpen(true) : router.push('/premium'))} style={s.filterRow}>
              <Ionicons name="options-outline" size={18} color={colors.violet} />
              <T style={{ flex: 1, fontFamily: fonts.semibold }}>{paid ? (filterLabel || 'Advanced filters') : 'Advanced filters'}</T>
              {!paid && <PremiumBadge />}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
            <GradientButton label={searching ? 'Searching the world…' : 'Find a stranger'} icon="sparkles" loading={searching} onPress={find} />
            {none && <T v="caption" color={colors.warning} style={{ textAlign: 'center' }}>No one new fits right now. Try another mode or filter.</T>}
            {left === 0 && plan?.tier !== 'vip' && (
              <Pressable onPress={() => router.push('/premium')} style={s.upsell}>
                <Text style={{ fontSize: 18 }}>👑</Text>
                <T style={{ flex: 1, fontFamily: fonts.semibold, fontSize: 14 }}>{plan?.tier === 'plus' ? 'VIP gives you 25 matches a day and Super Connects.' : 'Plus gives you 10 matches a day, VIP 25.'}</T>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            )}
          </View>
        )}

        {waiting.length > 0 && <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>Waiting for {waiting.length} {waiting.length === 1 ? 'person' : 'people'} to join you.</T>}

        {others.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <T v="section">This week</T>
            {others.map((m, i) => (
              <Animated.View key={m.match_id} entering={FadeInDown.delay(i * 40)}>
                <Pressable onPress={() => m.conversation_id && router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id } })} style={s.mini}>
                  <AnonymousAvatar seed={m.other_avatar_seed} number={m.other_number} size={44} />
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: fonts.semibold }}><PersonName number={m.other_number} /> {flagOf(m.other_country)}</T>
                    <T v="caption" color={colors.textMuted}>
                      {m.conversation_id ? 'Chat open — tap to talk' : m.i_accepted === false ? 'Passed' : m.i_accepted ? 'Waiting for them' : 'New'}
                      {supers.has(m.match_id) ? ' · ⭐ Super' : ''}
                    </T>
                  </View>
                  <View style={s.pct}><Text style={s.pctText}>{m.compatibility}%</Text></View>
                </Pressable>
              </Animated.View>
            ))}
          </View>
        )}
      </ScrollView>

      <BottomSheet visible={filterOpen} onClose={() => setFilterOpen(false)} title="Advanced filters">
        <View style={{ gap: spacing.md }}>
          <T v="caption" color={colors.textSecondary}>Country</T>
          <View style={s.wrap}>
            <Pressable onPress={() => setFilters((f) => ({ ...f, country: null }))} style={[s.fchip, !filters.country && s.fchipOn]}><Text style={[s.fchipText, !filters.country && { color: colors.onPrimary, fontFamily: fonts.bold }]}>Anywhere</Text></Pressable>
            {FILTER_COUNTRIES.map((c) => (
              <Pressable key={c} onPress={() => setFilters((f) => ({ ...f, country: c }))} style={[s.fchip, filters.country === c && s.fchipOn]}>
                <Text style={[s.fchipText, filters.country === c && { color: colors.onPrimary, fontFamily: fonts.bold }]}>{flagOf(c)} {countryName(c)}</Text>
              </Pressable>
            ))}
          </View>
          <T v="caption" color={colors.textSecondary}>Age</T>
          <View style={s.wrap}>
            {AGE_RANGES.map((a) => {
              const on = (filters.minAge ?? null) === a.min && (filters.maxAge ?? null) === a.max;
              return (
                <Pressable key={a.label} onPress={() => setFilters((f) => ({ ...f, minAge: a.min, maxAge: a.max }))} style={[s.fchip, on && s.fchipOn]}>
                  <Text style={[s.fchipText, on && { color: colors.onPrimary, fontFamily: fonts.bold }]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <T v="caption" color={colors.textMuted}>Age filters only include members who chose to show their age.</T>
          <GradientButton label="Apply" onPress={() => setFilterOpen(false)} />
        </View>
      </BottomSheet>
      {searching && <Animated.View entering={FadeIn} pointerEvents="none" style={StyleSheet.absoluteFill} />}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.bold, fontSize: 28, letterSpacing: -0.6, color: colors.text },
  face: { borderRadius: 30, overflow: 'hidden', backgroundColor: colors.primary, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)' },
  faceGlow: { position: 'absolute', width: 260, height: 260, borderRadius: 130, backgroundColor: 'rgba(255,255,255,0.35)' },
  faceSheen: { position: 'absolute', top: 0, left: 0, right: 0, height: '38%', backgroundColor: 'rgba(255,255,255,0.08)' },
  faceInfo: { position: 'absolute', left: 12, right: 12, bottom: 12, paddingHorizontal: 16, paddingVertical: 12, gap: 3, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.93)' },
  faceName: { fontFamily: fonts.display, fontSize: 20, color: colors.text },
  faceMeta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  superTag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: '#EAF5FF' },
  superText: { fontFamily: fonts.bold, fontSize: 10.5, color: '#5A4100', letterSpacing: 0.6 },
  qBadge: { position: 'absolute', width: 68, height: 68, borderRadius: 34, padding: 4, backgroundColor: '#FFFFFF', shadowColor: '#172339', shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  qInner: { flex: 1, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  qText: { fontFamily: fonts.serif, fontSize: 34, lineHeight: 40, color: colors.onPrimary },
  behind: { position: 'absolute', top: 6, borderRadius: 30, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#172339', shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 },
  cardShadow: { shadowColor: '#172339', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 14 }, elevation: 12, borderRadius: 30 },
  hint: { position: 'absolute', top: 22, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.85)' },
  hintText: { fontFamily: fonts.extrabold, fontSize: 20, letterSpacing: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violetDeep },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 26 },
  round: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#172339', shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 38, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  modeOn: { backgroundColor: colors.primary, borderColor: colors.primaryDeep },
  modeText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  upsell: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: radius.lg, backgroundColor: '#FFF8E1', borderWidth: 1, borderColor: colors.goldSoft },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: radius.lg, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  pct: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.blush },
  pctText: { fontFamily: fonts.bold, fontSize: 13, color: colors.violetDeep },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  fchip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  fchipOn: { backgroundColor: colors.primary, borderColor: colors.primaryDeep },
  fchipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
});
