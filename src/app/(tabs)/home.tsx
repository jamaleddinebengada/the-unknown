import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { IconButton, Skeleton } from '@/components/ui';
import { ActivityCard, Avatar, CategoryTile, FreeNowButton, PersonCard, SectionHeader } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { discover, listActivities, stopFree } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/supabase';
import type { Activity, Person } from '@/lib/types';
import { listCompanions, type CompanionCard } from '@/features/companions/api';
import { CompanionTile } from '@/features/companions/ui';
import { useCategories } from '@/lib/useCategories';

/** Home: greeting, I'M FREE NOW, who is free, live activities, categories, tonight. */
export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { boot, refresh } = useAuth();
  const { list: cats, map } = useCategories();
  const [free, setFree] = useState<Person[] | null>(null);
  const [acts, setActs] = useState<Activity[] | null>(null);
  const [tonight, setTonight] = useState<Person[]>([]);
  const [ai, setAi] = useState<CompanionCard[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const hasZone = !!boot?.zone?.enabled;

  const load = useCallback(async () => {
    listCompanions({ limit: 12 }).then(setAi).catch(() => setAi([]));
    if (!hasZone) { setFree([]); setActs([]); return; }
    const [f, a, n] = await Promise.allSettled([discover('free_now', { radiusKm: 25, limit: 12 }), listActivities('nearby', { radiusKm: 25 }), discover('tonight', { radiusKm: 25, limit: 12 })]);
    setFree(f.status === 'fulfilled' ? f.value : []);
    setActs(a.status === 'fulfilled' ? a.value : []);
    setTonight(n.status === 'fulfilled' ? n.value : []);
  }, [hasZone]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const av = boot?.availability && new Date(boot.availability.ends_at).getTime() > Date.now() ? boot.availability : null;
  const cardW = (width - 40 - 12) / 2.3;
  const first = boot?.profile.display_name?.split(' ')[0] ?? '';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 10, paddingBottom: 30, gap: 18 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await refresh(); await load(); setRefreshing(false); }} tintColor={colors.text} />}>
      <View style={[s.pad, s.header]}>
        <Pressable onPress={() => router.push('/(tabs)/profile')}><Avatar path={boot?.profile.photo_path} name={boot?.profile.display_name} size={46} ring /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.hello}>{t('home.hello', { name: first })} 👋</Text>
          <Pressable onPress={() => router.push('/location')} style={s.city} accessibilityRole="button">
            <Ionicons name="location" size={14} color={colors.text} />
            <Text style={s.cityText} numberOfLines={1}>{boot?.zone?.enabled ? boot.zone.city ?? '—' : t('setup.chooseCity')}</Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
        <IconButton name="notifications-outline" label={t('notif.title')} badge={boot?.unread} onPress={() => router.push('/notifications')} />
      </View>

      <View style={s.pad}>
        <Text style={s.question}>{t('home.question')}</Text>
      </View>
      <View style={s.pad}>
        <FreeNowButton active={!!av} until={av?.ends_at} onPress={() => router.push('/free')}
          onStop={async () => { try { await stopFree(); await refresh(); } catch (e) { toast(friendlyError(e), 'error'); } }} />
      </View>

      {!hasZone ? (
        <Pressable onPress={() => router.push('/location')} style={[s.pad, s.banner]}>
          <Ionicons name="navigate" size={20} color={colors.text} /><Text style={s.bannerText}>{t('home.setLocation')}</Text><Ionicons name="chevron-forward" size={18} color={colors.text} />
        </Pressable>
      ) : (
        <>
          <View style={s.pad}><SectionHeader title={t('home.freePeople')} action={t('common.seeAll')} onAction={() => router.push('/(tabs)/radar')} /></View>
          {free === null ? (
            <View style={[s.pad, { flexDirection: 'row', gap: 12 }]}>{[0, 1, 2].map((i) => <Skeleton key={i} w={cardW} h={cardW * 1.3} r={20} />)}</View>
          ) : free.length === 0 ? (
            <View style={[s.pad]}><View style={s.empty}><Text style={s.emptyTitle}>{t('home.noOneFree')}</Text><Text style={s.emptyBody}>{t('home.noOneFreeBody')}</Text></View></View>
          ) : (
            <FlatList horizontal data={free} keyExtractor={(p) => p.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => <PersonCard p={item} width={cardW} cats={map} onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.id } })} />} />
          )}
        </>
      )}

      {(ai === null || ai.length > 0) && (
        <>
          <View style={s.pad}><SectionHeader title={t('ai.section')} action={t('common.seeAll')} onAction={() => router.push('/companions')} /></View>
          {ai === null ? (
            <View style={[s.pad, { flexDirection: 'row', gap: 12 }]}>{[0, 1, 2].map((i) => <Skeleton key={i} w={cardW} h={cardW * 1.5} r={20} />)}</View>
          ) : (
            <FlatList horizontal data={ai} keyExtractor={(c) => c.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item }) => <CompanionTile c={item} width={cardW} onPress={() => router.push({ pathname: '/companion/[id]', params: { id: item.id } })} />} />
          )}
        </>
      )}

      <Pressable onPress={() => router.push('/surprise')} style={[s.pad, s.surprise]} accessibilityRole="button">
        <Text style={{ fontSize: 30 }}>✨</Text>
        <View style={{ flex: 1 }}><Text style={s.surpriseTitle}>{t('home.surprise')}</Text><Text style={s.surpriseSub}>{t('home.surpriseSub')}</Text></View>
        <Ionicons name="arrow-forward-circle" size={30} color={colors.text} />
      </Pressable>

      <View style={s.pad}><SectionHeader title={t('home.categories')} /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 4 }}>
        {cats.map((c) => <CategoryTile key={c.id} c={c} size={64} onPress={() => (c.id === 'surprise' ? router.push('/surprise') : router.push({ pathname: '/activities', params: { category: c.id } }))} />)}
      </ScrollView>

      {hasZone && (
        <>
          <View style={s.pad}><SectionHeader title={t('home.liveActivities')} action={t('common.seeAll')} onAction={() => router.push('/activities')} /></View>
          {acts && acts.length === 0 ? (
            <Pressable onPress={() => router.push('/activity/new')} style={[s.pad]}><View style={s.empty}><Text style={s.emptyTitle}>{t('home.noActivities')}</Text><Text style={[s.emptyBody, { color: colors.accent, fontFamily: fonts.bold }]}>+ {t('home.createFirst')}</Text></View></Pressable>
          ) : (
            <FlatList horizontal data={acts ?? []} keyExtractor={(a) => a.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
              renderItem={({ item, index }) => <Animated.View entering={FadeInDown.delay(index * 60)}><ActivityCard a={item} cat={map.get(item.category)} width={width * 0.68} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: item.id } })} /></Animated.View>} />
          )}
          {tonight.length > 0 && (
            <>
              <View style={s.pad}><SectionHeader title={`🌙 ${t('home.tonight')}`} action={t('common.seeAll')} onAction={() => router.push({ pathname: '/(tabs)/radar', params: { mode: 'tonight' } })} /></View>
              <FlatList horizontal data={tonight} keyExtractor={(p) => p.id} showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}
                renderItem={({ item }) => <PersonCard p={item} width={cardW * 0.85} cats={map} onPress={() => router.push({ pathname: '/person/[id]', params: { id: item.id } })} />} />
            </>
          )}
        </>
      )}

      <Pressable onPress={() => router.push('/moments')} style={[s.pad, s.moments]} accessibilityRole="button">
        <Ionicons name="images" size={22} color={colors.accent} />
        <Text style={s.momentsText}>{t('home.moments')}</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  pad: { marginHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  hello: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  city: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start' },
  cityText: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.textSecondary, maxWidth: 200 },
  question: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text, letterSpacing: -0.8, lineHeight: 34 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 18, backgroundColor: colors.primarySoft },
  bannerText: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  empty: { padding: 18, borderRadius: 20, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 4 },
  emptyTitle: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  emptyBody: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted, lineHeight: 19 },
  surprise: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderRadius: 22, backgroundColor: colors.lavender },
  surpriseTitle: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  surpriseSub: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  moments: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, borderRadius: 18, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  momentsText: { flex: 1, fontFamily: fonts.bold, fontSize: 15, color: colors.text },
});
