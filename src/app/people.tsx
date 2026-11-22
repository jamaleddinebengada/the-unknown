import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { MaskLogo } from '@/components/Brand';
import { Float } from '@/components/Effects';
import { WorldMap } from '@/components/WorldMap';
import { BottomSheet, useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState, ErrorState, GradientButton, PremiumBadge, T } from '@/components/ui';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, spacing } from '@/constants/theme';
import { refreshPlan, usePlan } from '@/features/membership/usePlan';
import { usePersonMeta } from '@/hooks/usePersonMeta';
import { friendlyError } from '@/lib/supabase';
import { connectWith, getPeople } from '@/services/api';
import type { MatchFilters, Person } from '@/types/models';
import { haptic } from '@/utils/format';

const COUNTRIES = ['MA', 'FR', 'ES', 'US', 'GB', 'DE', 'IT', 'AE', 'SA', 'EG', 'TR', 'CA', 'BE', 'NL', 'BR', 'JP'];
const AGES: { label: string; min: number | null; max: number | null }[] = [
  { label: 'Any age', min: null, max: null }, { label: '18–24', min: 18, max: 24 }, { label: '25–34', min: 25, max: 34 }, { label: '35–44', min: 35, max: 44 }, { label: '45+', min: 45, max: null },
];

function PersonCard({ p, w, onConnect, onOpen, busy }: { p: Person; w: number; onConnect: () => void; onOpen: () => void; busy: boolean }) {
  const meta = usePersonMeta(p.unknown_number);
  const photo = meta?.photoUrl;
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`UNKNOWN #${p.unknown_number}`} style={[s.card, { width: w }]}>
      <View style={{ width: w, height: w * 1.12 }}>
        {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={250} /> : (
          <LinearGradient colors={['#FFF6D6', '#FFE466', '#FFD83D']} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }} style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <MaskLogo size={w * 0.55} tone="ink" />
          </LinearGradient>
        )}
        {p.tier !== 'free' && <View style={{ position: 'absolute', top: 8, left: 8 }}><PremiumBadge label={p.tier === 'vip' ? 'VIP' : 'PLUS'} /></View>}
      </View>
      <View style={s.info}>
        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={s.name}>#{p.unknown_number}{p.age ? `, ${p.age}` : ''}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            {p.online && <View style={s.dot} />}
            <T v="caption" color={colors.textSecondary} numberOfLines={1}>{flagOf(p.country_code)} {p.country_code ? countryName(p.country_code) : 'Somewhere'}</T>
          </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Connect" disabled={busy} onPress={onConnect} hitSlop={8} style={s.heart}>
          {busy ? <ActivityIndicator size="small" color={colors.rose} /> : <Ionicons name="heart-outline" size={22} color={colors.rose} />}
        </Pressable>
      </View>
    </Pressable>
  );
}

/** Real members (never demo profiles). Plus/VIP can filter by country and age; VIP members appear first. */
export default function People() {
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const plan = usePlan();
  const paid = !!plan && plan.tier !== 'free';
  const [filters, setFilters] = useState<MatchFilters>({});
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [spot, setSpot] = useState<string | null>(null);
  const pins = useMemo(() => {
    const m = new Map<string, { count: number; online: boolean }>();
    for (const p of items) if (p.country_code) { const x = m.get(p.country_code) ?? { count: 0, online: false }; x.count++; x.online ||= p.online; m.set(p.country_code, x); }
    return [...m.entries()].map(([country, v]) => ({ country, ...v }));
  }, [items]);
  const shown = spot ? items.filter((p) => p.country_code === spot) : items;
  const onlineCount = items.filter((p) => p.online).length;
  const w = (width - spacing.md * 2 - 12) / 2;

  const load = useCallback(async (f: MatchFilters) => {
    setLoading(true);
    try { setItems(await getPeople(f)); setError(null); } catch (e) { setError(friendlyError(e)); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(filters); }, [load, filters]));

  const connect = async (p: Person) => {
    setBusy(p.unknown_number);
    try {
      const m = await connectWith(p.unknown_number);
      haptic.success();
      if (m?.conversation_id) router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id } });
      else toast('Request sent. When they join too, your private chat opens.', 'success');
      refreshPlan();
    } catch (e) {
      const msg = String((e as Error)?.message);
      toast(friendlyError(e), 'error');
      if (msg.includes('daily_limit_reached') && plan?.tier !== 'vip') router.push('/premium');
    } finally { setBusy(null); }
  };

  const label = [filters.country ? `${flagOf(filters.country)} ${countryName(filters.country)}` : 'Worldwide', AGES.find((a) => a.min === (filters.minAge ?? null) && a.max === (filters.maxAge ?? null))?.label ?? 'Any age'].join(' · ');

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Global Discovery" />
      <View style={s.bar}>
        <Pressable accessibilityRole="button" onPress={() => (paid ? setOpen(true) : router.push('/premium'))} style={s.filter}>
          <Ionicons name="location-outline" size={16} color={colors.violet} />
          <T style={{ fontFamily: fonts.semibold, flex: 1 }} numberOfLines={1}>{label}</T>
          {paid ? <Ionicons name="options-outline" size={17} color={colors.violet} /> : <PremiumBadge />}
        </Pressable>
      </View>
      {loading && !items.length ? <ActivityIndicator color={colors.violet} style={{ marginTop: 60 }} /> : error ? <ErrorState message={error} onRetry={() => load(filters)} /> : (
        <FlatList data={shown} keyExtractor={(p) => String(p.unknown_number)} numColumns={2}
          columnWrapperStyle={{ gap: 12 }} contentContainerStyle={{ padding: spacing.md, gap: 12, paddingBottom: 60 }}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 50).springify().damping(18)}>
              <Float index={index} amplitude={3}><PersonCard p={item} w={w} busy={busy === item.unknown_number} onConnect={() => connect(item)}
                onOpen={() => router.push({ pathname: '/user/[number]', params: { number: String(item.unknown_number) } })} /></Float>
            </Animated.View>
          )}
          ListHeaderComponent={
            <View style={{ gap: spacing.sm }}>
              <View style={s.mapCard}>
                <WorldMap width={width - spacing.md * 2 - 2} pins={pins} selected={spot} onSelect={setSpot} />
                <View style={s.mapInfo}>
                  <View style={s.liveDot} />
                  <T v="caption" style={{ fontFamily: fonts.semibold, flex: 1 }}>{spot ? `${flagOf(spot)} ${countryName(spot)} · ${shown.length} people` : `${items.length} real people · ${onlineCount} online now`}</T>
                  {spot && <Pressable onPress={() => setSpot(null)} hitSlop={8}><T v="caption" color={colors.coral} style={{ fontFamily: fonts.bold }}>Show all</T></Pressable>}
                </View>
              </View>
              <T v="caption" color={colors.textMuted}>Real members active this month — tap a yellow pin to explore a country. Photos appear only when members choose to share them. The heart sends a match request (it counts toward your daily matches).</T>
            </View>
          }
          ListEmptyComponent={<EmptyState icon="people-outline" title="No one here yet" body={filters.country || filters.minAge ? 'Try a wider filter.' : 'As more people join THE UNKNOWN, they will appear here.'} />} />
      )}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Filters">
        <View style={{ gap: spacing.md }}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[null, ...COUNTRIES].map((c) => {
              const on = (filters.country ?? null) === c;
              return <Pressable key={c ?? 'all'} onPress={() => setFilters((f) => ({ ...f, country: c }))} style={[s.chip, on && s.chipOn]}><Text style={[s.chipText, on && { color: colors.onPrimary, fontFamily: fonts.bold }]}>{c ? `${flagOf(c)} ${countryName(c)}` : 'Worldwide'}</Text></Pressable>;
            })}
          </ScrollView>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {AGES.map((a) => {
              const on = (filters.minAge ?? null) === a.min && (filters.maxAge ?? null) === a.max;
              return <Pressable key={a.label} onPress={() => setFilters((f) => ({ ...f, minAge: a.min, maxAge: a.max }))} style={[s.chip, on && s.chipOn]}><Text style={[s.chipText, on && { color: colors.onPrimary, fontFamily: fonts.bold }]}>{a.label}</Text></Pressable>;
            })}
          </View>
          <GradientButton label="Show people" onPress={() => setOpen(false)} />
        </View>
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  bar: { paddingHorizontal: spacing.md },
  mapCard: { borderRadius: 26, backgroundColor: '#F4FAFE', borderWidth: 1, borderColor: '#DCEEF9', overflow: 'hidden', paddingTop: 8, shadowColor: '#4A9CC9', shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  mapInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.9)' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  filter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, height: 44, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  card: { borderRadius: 22, overflow: 'hidden', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#243047', shadowOpacity: 0.1, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  info: { flexDirection: 'row', alignItems: 'center', padding: 10, gap: 6 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.success },
  heart: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primaryDeep },
  chipText: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
});
