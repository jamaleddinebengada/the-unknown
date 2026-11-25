import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet, useToast } from '@/components/Overlay';
import { MaskAvatar } from '@/components/PersonAvatar';
import { GradientButton, Skeleton, T } from '@/components/ui';
import { WorldMap } from '@/components/WorldMap';
import { CITIES, nearestCity } from '@/constants/cities';
import { INTERESTS, LANGUAGES } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, spacing } from '@/constants/theme';
import { usePlan } from '@/features/membership/usePlan';
import { nameOf, PersonPhoto, PersonRow, PersonTile, usePersonActions } from '@/features/people/PersonCards';
import { friendlyError } from '@/lib/supabase';
import { disableNearby, discoverPeople, getMyNearby, setNearbyLocation, type DiscoverSort } from '@/services/api';
import type { DiscoverFilters, PersonCard } from '@/types/models';
import { haptic } from '@/utils/format';

const RANGES: { km: number; label: string; vip?: boolean }[] = [
  { km: 5, label: '5 km' }, { km: 10, label: '10 km' }, { km: 25, label: '25 km' }, { km: 50, label: '50 km' }, { km: 100, label: '100 km', vip: true }, { km: 0, label: 'Worldwide' },
];
const AGES = [{ label: 'Any', min: null, max: null }, { label: '18–24', min: 18, max: 24 }, { label: '25–34', min: 25, max: 34 }, { label: '35–44', min: 35, max: 44 }, { label: '45+', min: 45, max: null }];
const GENDERS = [{ key: 'woman', label: 'Women' }, { key: 'man', label: 'Men' }, { key: 'nonbinary', label: 'Non-binary' }];
const SORTS: { key: DiscoverSort; label: string }[] = [{ key: 'distance', label: 'Nearest' }, { key: 'active', label: 'Active' }, { key: 'new', label: 'Newest' }];
type ViewMode = 'grid' | 'list' | 'radar';
const PAGE = 30;
type NearbyState = Awaited<ReturnType<typeof getMyNearby>>;

/** Expanding radar rings (static with Reduce Motion). */
function Radar({ size }: { size: number }) {
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {[0, 1, 2].map((i) => <RadarRing key={i} size={size} delay={i * 900} />)}
      <View style={s.radarCore}><Ionicons name="location" size={size * 0.16} color={colors.white} /></View>
    </View>
  );
}
function RadarRing({ size, delay }: { size: number; delay: number }) {
  const t = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => { if (!reduce) t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2700, easing: Easing.out(Easing.quad) }), -1))); }, [t, delay, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: reduce ? 0.3 : 0.55 * (1 - t.value), transform: [{ scale: reduce ? 0.7 : 0.25 + t.value * 0.75 }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: 'rgba(22,138,247,0.14)', borderWidth: 2, borderColor: 'rgba(22,138,247,0.45)' }, a]} />;
}

/** Abstract radar: people placed on their distance band, at an angle derived from their number. Not real positions. */
function BandRadar({ people, width, onOpen }: { people: PersonCard[]; width: number; onOpen: (p: PersonCard) => void }) {
  const bands = ['Under 5 km', '5–10 km', '10–25 km', '25–50 km', '50–100 km'];
  const R = width / 2;
  return (
    <View style={{ alignItems: 'center', gap: 10 }}>
      <View style={{ width, height: width }}>
        {bands.map((b, i) => {
          const r = R * (0.22 + (i + 1) * (0.74 / bands.length));
          return <View key={b} style={[s.ring, { width: r * 2, height: r * 2, borderRadius: r, left: R - r, top: R - r }]} />;
        })}
        <View style={[s.radarCore, { position: 'absolute', left: R - 18, top: R - 18, width: 36, height: 36, borderRadius: 18 }]}><Ionicons name="person" size={16} color={colors.white} /></View>
        {people.slice(0, 40).map((p) => {
          const bi = Math.max(0, bands.indexOf(p.distance_band ?? ''));
          const r = R * (0.22 + (bi + 0.5) * (0.74 / bands.length));
          const ang = ((p.unknown_number * 137.5) % 360) * (Math.PI / 180);
          const sz = 38;
          return (
            <Pressable key={p.unknown_number} onPress={() => onOpen(p)} accessibilityLabel={nameOf(p)}
              style={{ position: 'absolute', left: R + Math.cos(ang) * r - sz / 2, top: R + Math.sin(ang) * r - sz / 2 }}>
              <View style={s.radarDot}><PersonPhoto p={p} width={sz - 4} height={sz - 4} radius={sz} /></View>
            </Pressable>
          );
        })}
      </View>
      <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>Rings are distance bands. Positions on the radar are not real locations.</T>
    </View>
  );
}

function Chip({ label, on, onPress, lock }: { label: string; on: boolean; onPress: () => void; lock?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[s.chip, on && s.chipOn]}>
      {lock && <Ionicons name="diamond" size={11} color={on ? colors.white : colors.vip} />}
      <Text style={[s.chipText, on && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

export default function Nearby() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const plan = usePlan();
  const vip = !!plan && plan.tier !== 'free';
  const [status, setStatus] = useState<NearbyState | null>(null);
  const [km, setKm] = useState(25);
  const [mode, setMode] = useState<ViewMode>('grid');
  const [sort, setSort] = useState<DiscoverSort>('distance');
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [people, setPeople] = useState<PersonCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | 'filters' | 'city'>(null);
  const [denied, setDenied] = useState(false);
  const reqId = useRef(0);
  const worldwide = km === 0;
  const nearbyOn = !!status?.enabled && !status?.expired;
  const actions = usePersonActions((p) => setPeople((list) => list.map((x) => (x.unknown_number === p.unknown_number ? p : x))));
  const colW = (width - spacing.md * 2 - 12) / 2;

  const loadStatus = useCallback(async () => {
    try { const st = await getMyNearby(); setStatus(st); return st; } catch (e) { toast(friendlyError(e), 'error'); return null; }
  }, [toast]);

  const search = useCallback(async (reset: boolean, st?: NearbyState | null) => {
    const on = !!(st ?? status)?.enabled && !(st ?? status)?.expired;
    if (!worldwide && !on) { setPeople([]); return; }
    const id = ++reqId.current;
    if (reset) { setLoading(true); setDone(false); }
    try {
      const list = await discoverPeople(worldwide ? 'world' : 'nearby', km || 25, filters, worldwide && sort === 'distance' ? 'active' : sort, false, reset ? 0 : people.length, PAGE);
      if (id !== reqId.current) return;
      setPeople((prev) => (reset ? list : [...prev, ...list.filter((x) => !prev.some((y) => y.unknown_number === x.unknown_number))]));
      if (list.length < PAGE) setDone(true);
    } catch (e) { if (id === reqId.current) toast(friendlyError(e), 'error'); } finally { if (id === reqId.current) { setLoading(false); setRefreshing(false); } }
  }, [worldwide, km, filters, sort, people.length, status, toast]);

  useFocusEffect(useCallback(() => { loadStatus(); }, [loadStatus]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (status) search(true); }, [status?.enabled, status?.expired, km, sort, filters]);

  /** Ask for foreground location only when the person turns Nearby on; store only a coarse cell. */
  const locate = async () => {
    setBusy('locate');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { setDenied(!perm.canAskAgain); toast('Location was not allowed. You can choose a city instead.'); return; }
      if (!(await Location.hasServicesEnabledAsync())) { toast('Location services are off on this phone.'); setDenied(true); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
      const { latitude: lat, longitude: lng } = pos.coords;
      let city = ''; let country = '';
      try {
        const g = (await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }))[0];
        city = g?.city ?? g?.subregion ?? g?.region ?? ''; country = g?.isoCountryCode ?? '';
      } catch { /* geocoder unavailable */ }
      if (!city || !country) { const n = nearestCity(lat, lng); city = city || n.name; country = country || n.country; }
      await setNearbyLocation(lat, lng, city, country);
      haptic.success(); toast(`Nearby is on around ${city}`, 'success');
      if (km === 0) setKm(25);
      await loadStatus();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  const chooseCity = async (c: (typeof CITIES)[number]) => {
    setSheet(null); setBusy('city');
    try { await setNearbyLocation(c.lat, c.lng, c.name, c.country); haptic.success(); if (km === 0) setKm(25); await loadStatus(); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  const turnOff = () => Alert.alert('Turn off Nearby?', 'Your approximate area is erased right away and you disappear from Nearby.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Turn off', style: 'destructive', onPress: async () => { try { await disableNearby(); setPeople([]); await loadStatus(); toast('Nearby is off and your area was erased.', 'success'); } catch (e) { toast(friendlyError(e), 'error'); } } },
  ]);
  const pickRange = (r: (typeof RANGES)[number]) => {
    if (r.vip && !vip) { toast('100 km is part of VIP.'); router.push('/premium'); return; }
    haptic.tap(); setKm(r.km);
  };
  const open = (p: PersonCard) => router.push({ pathname: '/user/[number]', params: { number: String(p.unknown_number) } });
  const activeFilters = useMemo(() => Object.values(filters).filter((v) => (Array.isArray(v) ? v.length : v != null && v !== false)).length, [filters]);

  const header = (
    <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
      <View style={s.top}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Nearby</Text>
          <Pressable onPress={() => setSheet('city')} hitSlop={6} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }} accessibilityRole="button" accessibilityLabel="Change area">
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={s.sub} numberOfLines={1}>{worldwide ? 'Worldwide' : nearbyOn ? `${status?.city ?? 'Your area'}${status?.country_code ? ` ${flagOf(status.country_code)}` : ''}` : 'Location off'}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
        {nearbyOn && <Pressable onPress={locate} accessibilityLabel="Refresh my location" style={s.round}>{busy === 'locate' ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="locate" size={20} color={colors.text} />}</Pressable>}
        <Pressable onPress={() => setMode(mode === 'grid' ? 'list' : mode === 'list' ? 'radar' : 'grid')} accessibilityLabel="Change view" style={s.round}>
          <Ionicons name={mode === 'grid' ? 'list' : mode === 'list' ? 'radio-outline' : 'grid'} size={20} color={colors.text} />
        </Pressable>
        <Pressable onPress={() => setSheet('filters')} accessibilityLabel="Filters" style={s.round}>
          <Ionicons name="options-outline" size={20} color={colors.text} />
          {activeFilters > 0 && <View style={s.filterDot}><Text style={s.filterDotText}>{activeFilters}</Text></View>}
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: spacing.md }}>
        {RANGES.map((r) => <Chip key={r.label} label={r.label} on={km === r.km} lock={r.vip && !vip} onPress={() => pickRange(r)} />)}
      </ScrollView>
    </View>
  );

  const showEnable = !worldwide && status && !nearbyOn;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 6 }}>
      {header}
      {!status ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> : showEnable ? (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, alignItems: 'center', gap: spacing.md }}>
          <Animated.View entering={FadeIn.duration(500)}><Radar size={Math.min(width * 0.62, 260)} /></Animated.View>
          <Text style={s.hero}>{status.expired ? 'Refresh your area' : 'Meet people near you'}</Text>
          <T color={colors.textSecondary} style={{ textAlign: 'center' }}>Turn on Nearby to see real people around you and let them find you.</T>
          <View style={s.points}>
            {[
              ['shield-checkmark-outline', 'Only an approximate area (about 2 km) is stored — never your exact position.'],
              ['eye-off-outline', 'Others see a distance band like “5–10 km”, never your address.'],
              ['power-outline', 'Turn it off anytime — your area is erased right away.'],
            ].map(([icon, text]) => (
              <View key={text} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={18} color={colors.primary} />
                <T v="caption" color={colors.textSecondary} style={{ flex: 1 }}>{text}</T>
              </View>
            ))}
          </View>
          <GradientButton icon="location" label={status.expired ? 'Refresh location' : 'Enable location'} loading={busy === 'locate'} onPress={locate} style={{ alignSelf: 'stretch' }} />
          {denied && (
            <Pressable onPress={() => Linking.openSettings()} accessibilityRole="button" style={s.linkBtn}>
              <Ionicons name="settings-outline" size={16} color={colors.primary} /><Text style={s.link}>Open phone settings</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setSheet('city')} accessibilityRole="button" style={s.linkBtn}>
            <Ionicons name="business-outline" size={16} color={colors.primary} /><Text style={s.link}>{busy === 'city' ? 'Saving…' : 'Choose a city instead'}</Text>
          </Pressable>
          <Pressable onPress={() => setKm(0)} accessibilityRole="button" style={s.linkBtn}>
            <Ionicons name="earth-outline" size={16} color={colors.primary} /><Text style={s.link}>Browse worldwide</Text>
          </Pressable>
        </ScrollView>
      ) : loading && people.length === 0 ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: spacing.md }}>
          {[0, 1, 2, 3].map((i) => <View key={i} style={{ width: colW, gap: 8 }}><Skeleton w={colW} h={colW * 1.28} r={16} /><Skeleton w="70%" h={14} /><Skeleton w="45%" h={12} /></View>)}
        </View>
      ) : mode === 'radar' ? (
        <ScrollView contentContainerStyle={{ padding: spacing.md, paddingBottom: 120 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); search(true); }} tintColor={colors.primary} />}>
          {worldwide ? (
            <View style={{ gap: 10 }}>
              <View style={s.mapCard}><WorldMap width={width - spacing.md * 2 - 2} pins={countryPins(people)} /></View>
              <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>Countries of members active recently. No exact locations are shown.</T>
            </View>
          ) : <BandRadar people={people} width={width - spacing.md * 2} onOpen={open} />}
        </ScrollView>
      ) : (
        <FlatList key={mode} data={people} keyExtractor={(p) => String(p.unknown_number)} numColumns={mode === 'grid' ? 2 : 1}
          columnWrapperStyle={mode === 'grid' ? { gap: 12 } : undefined}
          contentContainerStyle={{ padding: mode === 'grid' ? spacing.md : 0, gap: mode === 'grid' ? 12 : 0, paddingBottom: 120 }}
          ItemSeparatorComponent={mode === 'list' ? () => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 92 }} /> : undefined}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(300)}>
              {mode === 'grid'
                ? <PersonTile p={item} width={colW} onOpen={() => open(item)} onFavorite={() => actions.favorite(item)} onSayHi={() => actions.sayHi(item)} busy={actions.busy === `hi${item.unknown_number}`} />
                : <PersonRow p={item} onOpen={() => open(item)} onFavorite={() => actions.favorite(item)} onSayHi={() => actions.sayHi(item)} busy={actions.busy === `hi${item.unknown_number}`} />}
            </Animated.View>
          )}
          onEndReachedThreshold={0.4} onEndReached={() => { if (!loading && !done && people.length) search(false); }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); search(true); }} tintColor={colors.primary} />}
          ListFooterComponent={loading && people.length ? <ActivityIndicator color={colors.primary} style={{ margin: 16 }} /> : undefined}
          ListEmptyComponent={
            <View style={s.empty}>
              <MaskAvatar seed="empty" size={72} />
              <Text style={s.emptyTitle}>No one here yet</Text>
              <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>
                {worldwide ? 'Try fewer filters.' : 'Only real members who turned on Nearby appear here. Try a wider distance, fewer filters, or Worldwide.'}
              </T>
              {!worldwide && <Pressable onPress={() => setKm(0)} style={s.linkBtn}><Text style={s.link}>See people worldwide</Text></Pressable>}
            </View>
          } />
      )}

      <BottomSheet visible={sheet === 'filters'} onClose={() => setSheet(null)} title="Filters">
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: spacing.md }}>
          <FilterGroup title="Sort by">{SORTS.map((o) => <Chip key={o.key} label={o.label} on={sort === o.key} onPress={() => setSort(o.key)} />)}</FilterGroup>
          <FilterGroup title="Age">{AGES.map((a) => <Chip key={a.label} label={a.label} on={(filters.min_age ?? null) === a.min && (filters.max_age ?? null) === a.max} onPress={() => setFilters((f) => ({ ...f, min_age: a.min, max_age: a.max }))} />)}</FilterGroup>
          <FilterGroup title="Show me">{GENDERS.map((g) => { const on = !!filters.genders?.includes(g.key); return <Chip key={g.key} label={g.label} on={on} onPress={() => setFilters((f) => ({ ...f, genders: on ? (f.genders ?? []).filter((x) => x !== g.key) : [...(f.genders ?? []), g.key] }))} />; })}</FilterGroup>
          <FilterGroup title="Status">
            <Chip label="Online now" on={!!filters.online} onPress={() => setFilters((f) => ({ ...f, online: !f.online }))} />
            <Chip label="Active today" lock={!vip} on={!!filters.recent} onPress={() => (vip ? setFilters((f) => ({ ...f, recent: !f.recent })) : router.push('/premium'))} />
            <Chip label="New members" lock={!vip} on={!!filters.new} onPress={() => (vip ? setFilters((f) => ({ ...f, new: !f.new })) : router.push('/premium'))} />
          </FilterGroup>
          <FilterGroup title={vip ? 'Language' : 'Language · VIP'}>
            {LANGUAGES.slice(0, 8).map((l) => <Chip key={l.code} label={l.label} lock={!vip} on={filters.language === l.code} onPress={() => (vip ? setFilters((f) => ({ ...f, language: f.language === l.code ? null : l.code })) : router.push('/premium'))} />)}
          </FilterGroup>
          <FilterGroup title={vip ? 'Interests' : 'Interests · VIP'}>
            {INTERESTS.slice(0, 12).map((i) => { const on = !!filters.interests?.includes(i.slug); return <Chip key={i.slug} label={i.label} lock={!vip} on={on} onPress={() => (vip ? setFilters((f) => ({ ...f, interests: on ? (f.interests ?? []).filter((x) => x !== i.slug) : [...(f.interests ?? []), i.slug] })) : router.push('/premium'))} />; })}
          </FilterGroup>
          {worldwide && (
            <FilterGroup title={vip ? 'Country' : 'Country · VIP'}>
              {['MA', 'FR', 'ES', 'US', 'GB', 'DE', 'IT', 'AE', 'SA', 'EG', 'TR', 'CA'].map((c) => <Chip key={c} label={`${flagOf(c)} ${countryName(c)}`} lock={!vip} on={filters.country === c} onPress={() => (vip ? setFilters((f) => ({ ...f, country: f.country === c ? null : c })) : router.push('/premium'))} />)}
            </FilterGroup>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable onPress={() => setFilters({})} style={[s.linkBtn, { flex: 1, justifyContent: 'center' }]}><Text style={s.link}>Reset</Text></Pressable>
            <GradientButton small label="Show results" onPress={() => setSheet(null)} style={{ flex: 2 }} />
          </View>
        </ScrollView>
      </BottomSheet>

      <BottomSheet visible={sheet === 'city'} onClose={() => setSheet(null)} title="Your area">
        <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 2 }}>
          <Pressable onPress={() => { setSheet(null); locate(); }} style={s.cityRow}><Ionicons name="locate" size={18} color={colors.primary} /><Text style={[s.cityText, { color: colors.primary }]}>Use my current location</Text></Pressable>
          {CITIES.map((c) => (
            <Pressable key={`${c.name}${c.country}`} onPress={() => chooseCity(c)} style={s.cityRow}>
              <Text style={{ fontSize: 16 }}>{flagOf(c.country)}</Text><Text style={s.cityText}>{c.name}</Text>
            </Pressable>
          ))}
          {nearbyOn && <Pressable onPress={() => { setSheet(null); turnOff(); }} style={s.cityRow}><Ionicons name="power" size={18} color={colors.danger} /><Text style={[s.cityText, { color: colors.danger }]}>Turn off Nearby & erase my area</Text></Pressable>}
        </ScrollView>
      </BottomSheet>
    </View>
  );
}

function countryPins(list: PersonCard[]) {
  const m = new Map<string, number>();
  for (const p of list) if (p.country_code) m.set(p.country_code, (m.get(p.country_code) ?? 0) + 1);
  return [...m.entries()].map(([country, count]) => ({ country, count }));
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T v="overline" color={colors.textMuted}>{title.toUpperCase()}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{children}</View>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.md },
  title: { fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: -0.6, color: colors.text },
  sub: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary, maxWidth: 180 },
  round: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  filterDot: { position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  filterDotText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary },
  hero: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text, textAlign: 'center' },
  points: { alignSelf: 'stretch', gap: 12, padding: spacing.md, borderRadius: 16, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  linkBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14 },
  link: { fontFamily: fonts.semibold, fontSize: 15, color: colors.primary },
  radarCore: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white },
  ring: { position: 'absolute', borderWidth: 1, borderColor: 'rgba(22,138,247,0.25)', backgroundColor: 'rgba(22,138,247,0.03)' },
  radarDot: { padding: 2, borderRadius: 20, backgroundColor: colors.white, shadowColor: '#172339', shadowOpacity: 0.15, shadowRadius: 6, elevation: 3 },
  mapCard: { borderRadius: 18, backgroundColor: '#F5FAFF', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden', paddingVertical: 8 },
  empty: { alignItems: 'center', gap: 8, padding: spacing.xl, marginTop: 30 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 18, color: colors.text },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4 },
  cityText: { fontFamily: fonts.medium, fontSize: 15.5, color: colors.text },
});
