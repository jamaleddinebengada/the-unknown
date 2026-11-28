import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheet } from '@/components/Overlay';
import { EmptyState, GradientButton } from '@/components/ui';
import { Chip, PersonCard, Radar } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { catName, t } from '@/i18n';
import { discover, type DiscoverMode } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/supabase';
import type { Person } from '@/lib/types';
import { useCategories } from '@/lib/useCategories';

const DIST = [3, 5, 10, 25, 50];
const AGES: [number | null, number | null, string][] = [[null, null, 'any'], [18, 25, '18–25'], [25, 35, '25–35'], [35, 50, '35–50'], [50, null, '50+']];

/** Live radar of who is free (or nearby / tonight), with a list alternative and filters. */
export default function RadarTab() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mode?: DiscoverMode }>();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { boot } = useAuth();
  const { list: cats, map } = useCategories();
  const [mode, setMode] = useState<DiscoverMode>(params.mode ?? 'free_now');
  const [view, setView] = useState<'radar' | 'list'>('radar');
  const [km, setKm] = useState(10);
  const [cat, setCat] = useState<string | null>(null);
  const [age, setAge] = useState(0);
  const [people, setPeople] = useState<Person[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => { if (params.mode) setMode(params.mode); }, [params.mode]);

  const load = useCallback(async () => {
    if (!boot?.zone?.enabled) { setPeople([]); return; }
    try { setError(null); setPeople(await discover(mode, { radiusKm: km, category: cat, minAge: AGES[age][0], maxAge: AGES[age][1], limit: 50 })); }
    catch (e) { setError(friendlyError(e)); setPeople([]); }
  }, [mode, km, cat, age, boot?.zone?.enabled]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cardW = (width - 20 * 2 - 12) / 2;
  const nFilters = (cat ? 1 : 0) + (age ? 1 : 0);

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <View style={s.top}>
        <Text style={s.title}>{t('radar.title')}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable onPress={() => setView(view === 'radar' ? 'list' : 'radar')} style={s.round} accessibilityLabel={view === 'radar' ? t('radar.list') : t('radar.map')}>
            <Ionicons name={view === 'radar' ? 'grid' : 'radio'} size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={() => setFilters(true)} style={s.round} accessibilityLabel="Filters">
            <Ionicons name="options" size={20} color={colors.text} />
            {nFilters > 0 && <View style={s.badge}><Text style={s.badgeText}>{nFilters}</Text></View>}
          </Pressable>
        </View>
      </View>
      <View style={s.seg}>
        {([['free_now', t('radar.freeNow')], ['tonight', t('radar.tonight')], ['nearby', t('radar.everyone')]] as const).map(([k, l]) => (
          <Pressable key={k} onPress={() => setMode(k)} style={[s.segItem, mode === k && s.segOn]} accessibilityRole="tab" accessibilityState={{ selected: mode === k }}>
            <Text style={[s.segText, mode === k && { fontFamily: fonts.bold }]}>{l}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {DIST.map((d) => <Chip key={d} label={`${d} km`} on={km === d} onPress={() => setKm(d)} />)}
      </ScrollView>
    </View>
  );

  if (!boot?.zone?.enabled) {
    return (
      <View style={[s.screen, { paddingTop: insets.top + 10 }]}>
        <View style={{ paddingHorizontal: 20 }}>{header}</View>
        <EmptyState icon="navigate-outline" title={t('setup.locationTitle')} body={t('home.setLocation')} action={t('setup.useLocation')} onAction={() => router.push('/location')} />
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top + 10 }]}>
      {view === 'radar' ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}>
          {header}
          <View style={{ alignItems: 'center', marginTop: 6 }}>
            {people === null ? <ActivityIndicator color={colors.text} style={{ margin: 60 }} /> :
              <Radar size={width - 40} people={people} onPick={(p) => router.push({ pathname: '/person/[id]', params: { id: p.id } })} />}
          </View>
          <View style={s.note}><Ionicons name="shield-checkmark" size={16} color={colors.online} /><Text style={s.noteText}>{t('radar.privacy')}</Text></View>
          {people && people.length === 0 && (
            <View style={{ gap: 10, marginTop: 10 }}>
              <Text style={s.emptyTitle}>{error ?? t('radar.empty')}</Text>
              <Text style={s.emptyBody}>{t('radar.emptyBody')}</Text>
              {km < 50 && <GradientButton small label={`${DIST[Math.min(DIST.indexOf(km) + 1, DIST.length - 1)]} km`} onPress={() => setKm(DIST[Math.min(DIST.indexOf(km) + 1, DIST.length - 1)])} />}
              {!boot.availability && <GradientButton small icon="flash" label={t('home.freeNow')} onPress={() => router.push('/free')} />}
            </View>
          )}
          {!!people?.length && <Text style={s.count}>{people.length} · {mode === 'nearby' ? t('radar.everyone') : mode === 'tonight' ? t('radar.tonight') : t('radar.freeNow')}</Text>}
        </ScrollView>
      ) : (
        <FlatList data={people ?? []} numColumns={2} keyExtractor={(p) => p.id} ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30, gap: 12 }} columnWrapperStyle={{ gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
          ListEmptyComponent={people === null ? <ActivityIndicator color={colors.text} /> : <EmptyState icon="radio-outline" title={error ?? t('radar.empty')} body={t('radar.emptyBody')} />}
          renderItem={({ item }) => <PersonCard p={item} width={cardW} cats={map} onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.id } })} />} />
      )}
      <BottomSheet visible={filters} onClose={() => setFilters(false)} title="Filters">
        <ScrollView style={{ maxHeight: 440 }} contentContainerStyle={{ gap: 12 }}>
          <Text style={s.fLabel}>{t('radar.activity')}</Text>
          <View style={s.wrap}>
            <Chip label={t('radar.any')} on={!cat} onPress={() => setCat(null)} />
            {cats.filter((c) => c.id !== 'surprise').map((c) => <Chip key={c.id} emoji={c.emoji} label={catName(c)} on={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />)}
          </View>
          <Text style={s.fLabel}>{t('radar.age')}</Text>
          <View style={s.wrap}>{AGES.map((a, i) => <Chip key={a[2]} label={i === 0 ? t('radar.any') : a[2]} on={age === i} onPress={() => setAge(i)} />)}</View>
          <GradientButton small label={t('common.done')} onPress={() => setFilters(false)} />
        </ScrollView>
      </BottomSheet>
    </View>
  );
}
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, letterSpacing: -0.6 },
  round: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.bold, fontSize: 10, color: '#fff' },
  seg: { flexDirection: 'row', padding: 4, borderRadius: 18, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 14 },
  segOn: { backgroundColor: colors.primary },
  segText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.text },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, padding: 12, borderRadius: 14, backgroundColor: '#ECFDF3' },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 17, color: colors.text, textAlign: 'center' },
  emptyBody: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, textAlign: 'center' },
  count: { fontFamily: fonts.semibold, fontSize: 13, color: colors.textMuted, textAlign: 'center', marginTop: 10 },
  fLabel: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
