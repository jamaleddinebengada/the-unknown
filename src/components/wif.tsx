import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors, fonts } from '@/constants/theme';
import { catName, duration, t, type TKey } from '@/i18n';
import { photoUrl } from '@/lib/supabase';
import type { Activity, Category, Person } from '@/lib/types';
import { haptic } from '@/utils/format';

/* ---------------- Avatar: real photo, or initial on a warm tint ---------------- */
const TINTS = ['#FFF1A8', '#FFE1C2', '#E7ECFF', '#EEE8FF', '#DCFCE7', '#FFE4E5'];
export function Avatar({ path, name, size = 44, ring, online }: { path?: string | null; name?: string | null; size?: number; ring?: boolean; online?: boolean }) {
  const url = photoUrl(path);
  const initial = (name?.trim()?.[0] ?? '•').toUpperCase();
  const tint = TINTS[(name?.charCodeAt(0) ?? 0) % TINTS.length];
  return (
    <View style={{ width: size, height: size }}>
      <View style={[{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: tint, alignItems: 'center', justifyContent: 'center' }, ring && { borderWidth: 2.5, borderColor: colors.primary }]}>
        {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> :
          <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.42, color: colors.text }}>{initial}</Text>}
      </View>
      {online && <View style={[s.dot, { width: size * 0.26, height: size * 0.26, borderRadius: size * 0.13 }]} />}
    </View>
  );
}

export const distLabel = (d?: string | null) => (d ? t(`dist.${d}` as TKey) : null);

/** Live "free" badge with a breathing green dot. */
export function LivePill({ until, small }: { until: string; small?: boolean }) {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 30_000); return () => clearInterval(id); }, []);
  const left = new Date(until).getTime() - Date.now();
  if (left <= 0) return null;
  return (
    <View style={[s.live, small && { paddingHorizontal: 7, paddingVertical: 3 }]}>
      <Pulse size={small ? 6 : 8} />
      <Text style={[s.liveText, small && { fontSize: 10.5 }]}>{duration(left)}</Text>
    </View>
  );
}

export function Pulse({ size = 8, color = colors.live }: { size?: number; color?: string }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => { if (!reduced) v.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.ease) }), -1)); }, [reduced, v]);
  const ring = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - v.value), transform: [{ scale: 1 + v.value * 1.6 }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }, ring]} />
      <View style={{ width: size, height: size, borderRadius: size, backgroundColor: color }} />
    </View>
  );
}

/* ---------------- Person card (photo-first) ---------------- */
export const PersonCard = memo(function PersonCard({ p, width, cats, onPress }: { p: Person; width: number; cats: Map<string, Category>; onPress: () => void }) {
  const h = width * 1.3;
  const url = photoUrl(p.photo_path);
  const freeCats = (p.free?.categories ?? []).slice(0, 2).map((c) => cats.get(c)).filter(Boolean) as Category[];
  return (
    <Pressable onPress={() => { haptic.tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={`${p.name ?? ''}${p.age ? `, ${p.age}` : ''}`}
      style={({ pressed }) => [s.card, { width, height: h }, pressed && { transform: [{ scale: 0.98 }] }]}>
      {url ? <Image source={{ uri: url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} /> : (
        <LinearGradient colors={['#FFF6C2', '#FFE68A']} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
          <Text style={{ fontFamily: fonts.extrabold, fontSize: width * 0.36, color: 'rgba(24,32,43,0.28)' }}>{(p.name?.[0] ?? '?').toUpperCase()}</Text>
        </LinearGradient>
      )}
      <LinearGradient colors={['rgba(24,32,43,0)', 'rgba(24,32,43,0.05)', 'rgba(24,32,43,0.78)']} style={[StyleSheet.absoluteFill, { top: h * 0.4 }]} pointerEvents="none" />
      <View style={s.cardTop}>
        {p.free ? <LivePill until={p.free.until} small /> : p.online ? <View style={s.onlineTag}><Pulse size={6} /><Text style={s.onlineText}>online</Text></View> : <View />}
      </View>
      <View style={s.cardBottom} pointerEvents="none">
        {freeCats.length > 0 && (
          <View style={{ flexDirection: 'row', gap: 4, marginBottom: 4 }}>
            {freeCats.map((c) => <View key={c.id} style={s.catMini}><Text style={{ fontSize: 11 }}>{c.emoji}</Text><Text style={s.catMiniText} numberOfLines={1}>{catName(c)}</Text></View>)}
          </View>
        )}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={s.cardName} numberOfLines={1}>{p.name}{p.age ? `, ${p.age}` : ''}</Text>
          {p.verified && <Ionicons name="checkmark-circle" size={15} color={colors.primary} />}
        </View>
        <Text style={s.cardMeta} numberOfLines={1}>{[distLabel(p.distance), p.city].filter(Boolean).join(' · ')}</Text>
      </View>
    </Pressable>
  );
});

/* ---------------- Activity card ---------------- */
export function whenLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `${t('act.today')} · ${time}`;
  if (d.toDateString() === tomorrow.toDateString()) return `${t('act.tomorrow')} · ${time}`;
  return `${d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })} · ${time}`;
}

export const ActivityCard = memo(function ActivityCard({ a, cat, onPress, width, style }: { a: Activity; cat?: Category; onPress: () => void; width?: number; style?: StyleProp<ViewStyle> }) {
  const cover = photoUrl(a.cover_path);
  return (
    <Pressable onPress={() => { haptic.tap(); onPress(); }} accessibilityRole="button" accessibilityLabel={a.title}
      style={({ pressed }) => [s.act, width ? { width } : null, pressed && { transform: [{ scale: 0.985 }] }, style]}>
      <View style={[s.actCover, { backgroundColor: `${cat?.color ?? colors.primary}22` }]}>
        {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} /> : <Text style={{ fontSize: 40 }}>{cat?.emoji ?? '✨'}</Text>}
        <View style={s.actWhen}><Ionicons name="time-outline" size={12} color={colors.text} /><Text style={s.actWhenText}>{whenLabel(a.starts_at)}</Text></View>
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <Text style={s.actTitle} numberOfLines={2}>{a.title}</Text>
        <View style={s.row}><Ionicons name="location-outline" size={13} color={colors.textMuted} /><Text style={s.actMeta} numberOfLines={1}>{a.place_name}{a.distance ? ` · ${distLabel(a.distance)}` : ''}</Text></View>
        <View style={[s.row, { justifyContent: 'space-between', marginTop: 4 }]}>
          <View style={s.row}><Avatar path={a.host.photo_path} name={a.host.name} size={22} /><Text style={s.actMeta} numberOfLines={1}>{a.host.name}</Text></View>
          <View style={s.going}><Ionicons name="people" size={12} color={colors.text} /><Text style={s.goingText}>{a.going}/{a.max}</Text></View>
        </View>
      </View>
    </Pressable>
  );
});

/* ---------------- Category tile ---------------- */
export function CategoryTile({ c, onPress, selected, size = 76 }: { c: Category; onPress: () => void; selected?: boolean; size?: number }) {
  return (
    <Pressable onPress={() => { haptic.tap(); onPress(); }} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={catName(c)}
      style={({ pressed }) => [{ width: size + 8, alignItems: 'center', gap: 6 }, pressed && { opacity: 0.8 }]}>
      <View style={[s.catTile, { width: size, height: size, backgroundColor: `${c.color}1F` }, selected && { borderColor: colors.text, borderWidth: 2, backgroundColor: colors.primary }]}>
        <Text style={{ fontSize: size * 0.42 }}>{c.emoji}</Text>
      </View>
      <Text style={s.catLabel} numberOfLines={2}>{catName(c)}</Text>
    </Pressable>
  );
}

export function Chip({ label, on, onPress, emoji }: { label: string; on?: boolean; onPress: () => void; emoji?: string }) {
  return (
    <Pressable onPress={() => { haptic.tap(); onPress(); }} accessibilityRole="button" accessibilityState={{ selected: on }}
      style={[s.chip, on && s.chipOn]}>
      {emoji && <Text style={{ fontSize: 14 }}>{emoji}</Text>}
      <Text style={[s.chipText, on && { fontFamily: fonts.bold }]}>{label}</Text>
    </Pressable>
  );
}

export function SectionHeader({ title, action, onAction, icon }: { title: string; action?: string; onAction?: () => void; icon?: ReactNode }) {
  return (
    <View style={s.section}>
      <View style={s.row}>{icon}<Text style={s.sectionTitle}>{title}</Text></View>
      {action && <Pressable onPress={onAction} hitSlop={8}><Text style={s.sectionAction}>{action}</Text></Pressable>}
    </View>
  );
}

/* ---------------- Signature: I'M FREE NOW button ---------------- */
export function FreeNowButton({ onPress, active, until, onStop }: { onPress: () => void; active: boolean; until?: string | null; onStop: () => void }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.set(withRepeat(withSequence(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.ease) }), withTiming(0, { duration: 1600, easing: Easing.inOut(Easing.ease) })), -1));
  }, [reduced, p]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: 0.35 + p.value * 0.4, transform: [{ scale: 1 + p.value * 0.04 }] }));
  if (active && until) {
    return (
      <View style={s.freeActive}>
        <Pulse size={12} />
        <View style={{ flex: 1 }}>
          <Text style={s.freeActiveTitle}>{t('home.youAreFree', { time: duration(new Date(until).getTime() - Date.now()) })}</Text>
          <Text style={s.freeActiveSub}>{t('free.live')}</Text>
        </View>
        <Pressable onPress={onStop} style={s.stop} accessibilityRole="button"><Text style={s.stopText}>{t('home.stop')}</Text></Pressable>
      </View>
    );
  }
  return (
    <Pressable onPress={() => { haptic.success(); onPress(); }} accessibilityRole="button" accessibilityLabel={t('home.freeNow')} style={{ alignItems: 'stretch' }}>
      <Animated.View style={[s.freeGlow, glowStyle]} />
      <LinearGradient colors={['#FFE24D', '#FFD600', '#FFC400']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.freeBtn}>
        <View style={s.freeIcon}><Ionicons name="flash" size={26} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={s.freeTitle}>{t('home.freeNow')}</Text>
          <Text style={s.freeSub}>{t('home.freeNowSub')}</Text>
        </View>
        <Ionicons name="arrow-forward" size={22} color={colors.text} />
      </LinearGradient>
    </Pressable>
  );
}

/* ---------------- Live radar ---------------- */
const BAND_RING: Record<string, number> = { under_3: 0.22, '3_5': 0.34, '5_10': 0.48, '10_25': 0.62, '25_50': 0.76, '50_100': 0.88, '100_plus': 0.95 };
/** People are placed on the ring of their distance band, at an angle derived from their id — never their real direction. */
export function Radar({ size, people, onPick }: { size: number; people: Person[]; onPick: (p: Person) => void }) {
  const reduced = useReducedMotion();
  const sweep = useSharedValue(0);
  useEffect(() => { if (!reduced) sweep.set(withRepeat(withTiming(1, { duration: 4200, easing: Easing.linear }), -1)); }, [reduced, sweep]);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.value * 360}deg` }] }));
  const R = size / 2;
  return (
    <View style={{ width: size, height: size }}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <View key={f} style={[s.ring, { width: size * f, height: size * f, borderRadius: size, left: R - (size * f) / 2, top: R - (size * f) / 2 }]} />
      ))}
      {[0, 1, 2].map((i) => <PulseRing key={i} size={size} delay={i * 1200} />)}
      <Animated.View style={[StyleSheet.absoluteFill, sweepStyle]} pointerEvents="none">
        <LinearGradient colors={['rgba(255,214,0,0.0)', 'rgba(255,214,0,0.35)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
          style={{ position: 'absolute', left: R, top: R - 1, width: R, height: 2 }} />
      </Animated.View>
      <View style={[s.me, { left: R - 14, top: R - 14 }]}><Ionicons name="person" size={14} color={colors.text} /></View>
      {people.slice(0, 24).map((p) => {
        let h = 0; for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) % 3600;
        const ang = (h / 10) * (Math.PI / 180);
        const r = R * (BAND_RING[p.distance ?? '5_10'] ?? 0.5);
        const sz = 40;
        return (
          <Pressable key={p.id} onPress={() => onPick(p)} accessibilityLabel={p.name ?? ''} style={{ position: 'absolute', left: R + r * Math.cos(ang) - sz / 2, top: R + r * Math.sin(ang) - sz / 2 }}>
            <Avatar path={p.photo_path} name={p.name} size={sz} ring={!!p.free} online={p.online} />
          </Pressable>
        );
      })}
    </View>
  );
}
function PulseRing({ size, delay }: { size: number; delay: number }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(0);
  useEffect(() => { if (!reduced) v.set(withDelay(delay, withRepeat(withTiming(1, { duration: 3600, easing: Easing.out(Easing.ease) }), -1))); }, [reduced, v, delay]);
  const st = useAnimatedStyle(() => ({ opacity: 0.5 * (1 - v.value), transform: [{ scale: 0.15 + v.value * 0.85 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, borderRadius: size, borderWidth: 2, borderColor: colors.primary }, st]} />;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { position: 'absolute', right: 0, bottom: 0, backgroundColor: colors.live, borderWidth: 2, borderColor: '#fff' },
  live: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.95)' },
  liveText: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  card: { borderRadius: 20, overflow: 'hidden', backgroundColor: colors.cream },
  cardTop: { position: 'absolute', left: 8, right: 8, top: 8, flexDirection: 'row', justifyContent: 'space-between' },
  onlineTag: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.95)' },
  onlineText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.text },
  cardBottom: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  cardName: { fontFamily: fonts.bold, fontSize: 16, color: '#fff', flexShrink: 1 },
  cardMeta: { fontFamily: fonts.medium, fontSize: 12, color: 'rgba(255,255,255,0.92)' },
  catMini: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.primary, maxWidth: '60%' },
  catMiniText: { fontFamily: fonts.semibold, fontSize: 10.5, color: colors.text, flexShrink: 1 },
  act: { borderRadius: 20, backgroundColor: colors.white, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  actCover: { height: 118, alignItems: 'center', justifyContent: 'center' },
  actWhen: { position: 'absolute', left: 10, top: 10, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.primary },
  actWhenText: { fontFamily: fonts.bold, fontSize: 11.5, color: colors.text },
  actTitle: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  actMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, flexShrink: 1 },
  going: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.primarySoft },
  goingText: { fontFamily: fonts.bold, fontSize: 12, color: colors.text },
  catTile: { borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  catLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.text, textAlign: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  sectionTitle: { fontFamily: fonts.extrabold, fontSize: 19, color: colors.text, letterSpacing: -0.3 },
  sectionAction: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.accent },
  freeGlow: { position: 'absolute', left: -6, right: -6, top: -6, bottom: -6, borderRadius: 30, backgroundColor: colors.primary },
  freeBtn: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 18, borderRadius: 26 },
  freeIcon: { width: 50, height: 50, borderRadius: 25, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  freeTitle: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, letterSpacing: 0.3 },
  freeSub: { fontFamily: fonts.medium, fontSize: 13, color: 'rgba(24,32,43,0.75)' },
  freeActive: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 22, backgroundColor: '#ECFDF3', borderWidth: 1, borderColor: '#B7F0CC' },
  freeActiveTitle: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  freeActiveSub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted },
  stop: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  stopText: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(24,32,43,0.08)', backgroundColor: 'rgba(255,214,0,0.04)' },
  me: { position: 'absolute', width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#fff' },
});
