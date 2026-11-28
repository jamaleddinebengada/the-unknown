import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState, IconButton } from '@/components/ui';
import { ActivityCard, Chip } from '@/components/wif';
import { colors } from '@/constants/theme';
import { catName, t } from '@/i18n';
import { listActivities, type ActivityMode } from '@/lib/api';
import { friendlyError } from '@/lib/supabase';
import type { Activity } from '@/lib/types';
import { useCategories } from '@/lib/useCategories';

/** Nearby / tonight / hosting / joined activities, filterable by category. */
export default function Activities() {
  const router = useRouter();
  const params = useLocalSearchParams<{ category?: string; mode?: ActivityMode }>();
  const { list: cats, map } = useCategories();
  const [mode, setMode] = useState<ActivityMode>(params.mode ?? 'nearby');
  const [cat, setCat] = useState<string | null>(params.category ?? null);
  const [items, setItems] = useState<Activity[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setError(null); setItems(await listActivities(mode, { category: cat, radiusKm: 50 })); } catch (e) { setError(friendlyError(e)); setItems([]); }
  }, [mode, cat]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <Screen>
      <StackHeader title={t('act.list')} right={<IconButton name="add" label={t('act.create')} onPress={() => router.push('/activity/new')} />} />
      <FlatList data={items ?? []} keyExtractor={(a) => a.id} contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        ListHeaderComponent={
          <View style={{ gap: 10 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {(['nearby', 'tonight', 'mine', 'joined'] as const).map((m) => <Chip key={m} label={t(`act.${m}`)} on={mode === m} onPress={() => setMode(m)} />)}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              <Chip label={t('radar.any')} on={!cat} onPress={() => setCat(null)} />
              {cats.filter((c) => c.id !== 'surprise').map((c) => <Chip key={c.id} emoji={c.emoji} label={catName(c)} on={cat === c.id} onPress={() => setCat(cat === c.id ? null : c.id)} />)}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={items === null ? <ActivityIndicator color={colors.text} /> : <EmptyState icon="calendar-outline" title={error ?? t('home.noActivities')} action={t('act.create')} onAction={() => router.push('/activity/new')} />}
        renderItem={({ item }) => <ActivityCard a={item} cat={map.get(item.category)} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: item.id } })} />} />
    </Screen>
  );
}
