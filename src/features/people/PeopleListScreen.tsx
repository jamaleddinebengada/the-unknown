import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Screen, StackHeader } from '@/components/Screen';
import { useToast } from '@/components/Overlay';
import { ErrorState, GradientButton, T } from '@/components/ui';
import { colors, fonts, gradients, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import type { PersonCard } from '@/types/models';
import { PersonRow, usePersonActions } from './PersonCards';

/** Shared screen for Favorites / Visitors lists. `load` returns people and whether the list is VIP-locked. */
export function PeopleListScreen({ title, load, emptyTitle, emptyBody, lockedTitle, lockedBody }: {
  title: string; load: () => Promise<{ people: PersonCard[]; locked?: boolean; count?: number }>;
  emptyTitle: string; emptyBody: string; lockedTitle?: (n: number) => string; lockedBody?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [data, setData] = useState<{ people: PersonCard[]; locked?: boolean; count?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const actions = usePersonActions((p) => setData((d) => d && { ...d, people: d.people.map((x) => (x.unknown_number === p.unknown_number ? p : x)) }));
  const fetch = useCallback(async () => {
    try { setData(await load()); setError(null); } catch (e) { setError(friendlyError(e)); toast(friendlyError(e), 'error'); } finally { setRefreshing(false); }
  }, [load, toast]);
  useFocusEffect(useCallback(() => { fetch(); }, [fetch]));
  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title={title} />
      {error && !data ? <ErrorState message={error} onRetry={fetch} /> : !data ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> : data.locked ? (
        <View style={s.locked}>
          <LinearGradient colors={gradients.gold} style={s.lockIcon}><Ionicons name="eye" size={30} color="#5A4000" /></LinearGradient>
          <Text style={s.title}>{lockedTitle?.(data.count ?? 0)}</Text>
          <T color={colors.textMuted} style={{ textAlign: 'center' }}>{lockedBody}</T>
          <GradientButton icon="diamond" label="Upgrade to VIP" colors={gradients.gold} onPress={() => router.push('/premium')} style={{ alignSelf: 'stretch' }} />
        </View>
      ) : (
        <FlatList data={data.people} keyExtractor={(p) => String(p.unknown_number)}
          ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: 92 }} />}
          renderItem={({ item }) => <PersonRow p={item} onOpen={() => router.push({ pathname: '/user/[number]', params: { number: String(item.unknown_number) } })}
            onFavorite={() => actions.favorite(item)} onSayHi={() => actions.sayHi(item)} busy={actions.busy === `hi${item.unknown_number}`} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} tintColor={colors.primary} />}
          ListEmptyComponent={<View style={s.locked}><Text style={s.title}>{emptyTitle}</Text><T color={colors.textMuted} style={{ textAlign: 'center' }}>{emptyBody}</T></View>} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  locked: { alignItems: 'center', gap: 10, margin: spacing.lg, padding: spacing.lg, borderRadius: 20, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  lockIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: fonts.bold, fontSize: 19, color: colors.text, textAlign: 'center' },
});
