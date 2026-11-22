import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { DiscoveryRings } from '@/components/Effects';
import { BottomSheet, useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState, GradientButton, PremiumBadge, T } from '@/components/ui';
import { CITIES, nearestCity } from '@/constants/cities';
import { interestLabel } from '@/constants/content';
import { flagOf } from '@/constants/countries';
import { colors, fonts, spacing } from '@/constants/theme';
import { refreshPlan } from '@/features/membership/usePlan';
import { friendlyError } from '@/lib/supabase';
import { connectWith, disableNearby, getNearby, getNearbyStatus, setNearbyLocation, type NearbyPerson } from '@/services/api';
import { haptic } from '@/utils/format';

const RADII = [5, 10, 25, 50, 100];
type Status = Awaited<ReturnType<typeof getNearbyStatus>> | null;

/**
 * People Nearby — opt-in. Only an approximate area is sent; the server snaps it to a ~2 km grid,
 * never returns coordinates and only shows distance bands. Turning it off erases the area.
 * Only real members appear here (AI characters never do).
 */
export default function Nearby() {
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [status, setStatus] = useState<Status>(null);
  const [radius, setRadius] = useState(25);
  const [people, setPeople] = useState<NearbyPerson[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [cityOpen, setCityOpen] = useState(false);

  const search = useCallback(async (r: number) => {
    setLoading(true);
    try { setPeople(await getNearby(r)); } catch (e) { toast(friendlyError(e), 'error'); } finally { setLoading(false); }
    getNearbyStatus().then(setStatus).catch(() => {});
  }, [toast]);

  const load = useCallback(async () => {
    try {
      const st = await getNearbyStatus();
      setStatus(st);
      if (st?.enabled) search(Math.min(radius, st.max_radius));
    } catch (e) { toast(friendlyError(e), 'error'); }
  }, [radius, search, toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const locateMe = async () => {
    setBusy('locate');
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') { toast('Location permission was not given. You can choose a city instead.'); setCityOpen(true); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest });
      const { latitude: lat, longitude: lng } = pos.coords;
      let city = ''; let country = '';
      try {
        const g = (await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }))[0];
        city = g?.city ?? g?.subregion ?? g?.region ?? ''; country = g?.isoCountryCode ?? '';
      } catch { /* geocoder unavailable: fall back below */ }
      if (!city || !country) { const n = nearestCity(lat, lng); city = city || n.name; country = country || n.country; }
      await setNearbyLocation(lat, lng, city, country);
      haptic.success(); toast(`Nearby is on around ${city}`, 'success');
      await load();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  const chooseCity = async (c: (typeof CITIES)[number]) => {
    setCityOpen(false); setBusy('city');
    try { await setNearbyLocation(c.lat, c.lng, c.name, c.country); haptic.success(); await load(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  const turnOff = () => Alert.alert('Turn off Nearby?', 'Your approximate area is erased right away and you disappear from Nearby.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Turn off', style: 'destructive', onPress: async () => { try { await disableNearby(); setPeople(null); await load(); toast('Nearby is off and your area was erased.', 'success'); } catch (e) { toast(friendlyError(e), 'error'); } } },
  ]);
  const pickRadius = (r: number) => {
    if (status && r > status.max_radius) { toast('50 and 100 km are part of UNKNOWN PLUS.'); router.push('/premium'); return; }
    haptic.tap(); setRadius(r); search(r);
  };
  const connect = async (p: NearbyPerson) => {
    setBusy(`c${p.unknown_number}`);
    try {
      const m = await connectWith(p.unknown_number);
      haptic.success();
      if (m?.conversation_id) router.push({ pathname: '/conversation/[id]', params: { id: m.conversation_id } });
      else toast('Request sent. When they join too, your private chat opens.', 'success');
      refreshPlan();
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  const enabled = !!status?.enabled;
  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="People Nearby" />
      {!status ? <ActivityIndicator color={colors.primaryDeep} style={{ marginTop: 60 }} /> : !enabled ? (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, alignItems: 'center' }}>
          <View style={{ width: 220, height: 220, alignItems: 'center', justifyContent: 'center' }}>
            <DiscoveryRings size={220} />
            <View style={s.pin}><Ionicons name="location" size={38} color={colors.text} /></View>
          </View>
          <Text style={s.title}>Meet people around you</Text>
          <T color={colors.textSecondary} style={{ textAlign: 'center' }}>Nearby is off. Turn it on to discover real members in your area — anonymously.</T>
          <View style={s.privacy}>
            {['Only your approximate area is used (about 2 km)', 'Nobody ever sees your exact position or address', 'Others see a distance band, like “5–10 km”', 'Turn it off anytime — your area is erased'].map((t) => (
              <View key={t} style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <Ionicons name="shield-checkmark" size={16} color={colors.success} /><T v="caption" style={{ flex: 1 }}>{t}</T>
              </View>
            ))}
          </View>
          <GradientButton label="Use my approximate location" icon="navigate" loading={busy === 'locate'} onPress={locateMe} style={{ alignSelf: 'stretch' }} />
          <Pressable accessibilityRole="button" onPress={() => setCityOpen(true)} style={s.secondary}><T style={{ fontFamily: fonts.bold }}>Choose a city instead</T></Pressable>
        </ScrollView>
      ) : (
        <FlatList data={people ?? []} keyExtractor={(p) => String(p.unknown_number)} contentContainerStyle={{ padding: spacing.md, gap: 12, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={{ gap: spacing.sm, marginBottom: 4 }}>
              <View style={s.area}>
                <Ionicons name="location" size={18} color={colors.coral} />
                <T style={{ flex: 1, fontFamily: fonts.bold }}>{status.city ?? 'Your area'}</T>
                <Pressable onPress={() => setCityOpen(true)} hitSlop={8}><T v="caption" style={{ fontFamily: fonts.bold }}>Change</T></Pressable>
                <Pressable onPress={turnOff} hitSlop={8}><T v="caption" color={colors.danger} style={{ fontFamily: fonts.bold }}>Turn off</T></Pressable>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {RADII.map((r) => {
                  const on = r === radius; const locked = r > status.max_radius;
                  return (
                    <Pressable key={r} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => pickRadius(r)} style={[s.radius, on && s.radiusOn]}>
                      <Text style={[s.radiusText, on && { fontFamily: fonts.extrabold }]}>{r} km</Text>
                      {locked && <Ionicons name="lock-closed" size={11} color={colors.gold} />}
                    </Pressable>
                  );
                })}
              </ScrollView>
              <T v="caption" color={colors.textMuted}>Real members only · {status.queries_left} searches left this hour</T>
            </View>
          }
          ListEmptyComponent={loading ? (
            <View style={{ alignItems: 'center', paddingTop: 30 }}><View style={{ width: 200, height: 200, alignItems: 'center', justifyContent: 'center' }}><DiscoveryRings size={200} /><T style={{ fontFamily: fonts.bold }}>Looking around…</T></View></View>
          ) : <EmptyState icon="people-outline" title="No one nearby yet" body={`No members have turned on Nearby within ${radius} km. Try a wider radius or check back later.`} />}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).springify().damping(18)}>
              <Pressable onPress={() => router.push({ pathname: '/user/[number]', params: { number: String(item.unknown_number) } })} style={s.card}>
                <AnonymousAvatar seed={item.avatar_seed} number={item.unknown_number} size={58} online={item.online} />
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={s.name}>#{item.unknown_number}{item.age ? `, ${item.age}` : ''}</Text>
                    {item.tier !== 'free' && <PremiumBadge label={item.tier === 'vip' ? 'VIP' : 'PLUS'} />}
                  </View>
                  <T v="caption" color={colors.textSecondary}>{item.distance_band} · {flagOf(item.country_code)} {item.city ?? 'Nearby'}</T>
                  {item.shared_interests.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {item.shared_interests.slice(0, 3).map((i) => <View key={i} style={s.tag}><T v="caption" style={{ fontFamily: fonts.semibold }}>{interestLabel(i)}</T></View>)}
                    </View>
                  )}
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Connect" disabled={!!busy} onPress={() => connect(item)} hitSlop={8} style={s.heart}>
                  {busy === `c${item.unknown_number}` ? <ActivityIndicator size="small" color={colors.coral} /> : <Ionicons name="heart" size={20} color={colors.coral} />}
                </Pressable>
              </Pressable>
            </Animated.View>
          )} />
      )}
      <BottomSheet visible={cityOpen} onClose={() => setCityOpen(false)} title="Choose a city">
        <ScrollView style={{ maxHeight: 420 }}>
          {CITIES.map((c) => (
            <Pressable key={c.name} onPress={() => chooseCity(c)} style={s.cityRow}><T>{flagOf(c.country)}  {c.name}</T></Pressable>
          ))}
        </ScrollView>
      </BottomSheet>
      {busy === 'city' && <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', width }]}><ActivityIndicator color={colors.primaryDeep} /></View>}
    </Screen>
  );
}

const s = StyleSheet.create({
  pin: { width: 86, height: 86, borderRadius: 43, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.white },
  title: { fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.6, color: colors.text, textAlign: 'center' },
  privacy: { alignSelf: 'stretch', gap: 10, padding: spacing.md, borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  secondary: { alignSelf: 'stretch', height: 52, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  area: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  radius: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 16, height: 38, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  radiusOn: { backgroundColor: colors.primary, borderColor: colors.primaryDeep },
  radiusText: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, shadowColor: '#25324A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  name: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text },
  tag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.cream },
  heart: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF1EE' },
  cityRow: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
});
