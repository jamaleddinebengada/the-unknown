import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Screen, StackHeader } from '@/components/Screen';
import { CategoryChip } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { listCompanions, type CompanionCard } from '@/features/companions/api';
import { CompanionTile } from '@/features/companions/ui';
import { catName, t } from '@/i18n';
import { friendlyError } from '@/lib/supabase';
import { useCategories } from '@/lib/useCategories';

/** "See all" of the Discover row: browse every AI companion, filter by interest or gender. */
export default function Companions() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { list: cats } = useCategories();
  const [interest, setInterest] = useState<string | null>(null);
  const [gender, setGender] = useState<'female' | 'male' | null>(null);
  const [items, setItems] = useState<CompanionCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(true);
  const load = useCallback(async (reset: boolean, cur: CompanionCard[] = []) => {
    try {
      const page = await listCompanions({ interest, gender, offset: reset ? 0 : cur.length, limit: 30 });
      setItems(reset ? page : [...cur, ...page]); setMore(page.length === 30); setError(null);
    } catch (e) { setError(friendlyError(e)); setItems((x) => x ?? []); }
  }, [interest, gender]);
  useFocusEffect(useCallback(() => { load(true); }, [load]));
  const w = (width - 20 * 2 - 12) / 2;
  return (
    <Screen>
      <StackHeader title={t('ai.section')} />
      <FlatList data={items ?? []} keyExtractor={(c) => c.id} numColumns={2} columnWrapperStyle={{ gap: 12, paddingHorizontal: 20 }} contentContainerStyle={{ gap: 12, paddingBottom: 40 }}
        onEndReachedThreshold={0.4} onEndReached={() => { if (more && items) load(false, items); }}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Text style={s.sub}>{t('ai.sectionSub')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              <CategoryChip label={t('ai.all')} selected={!gender} onPress={() => setGender(null)} />
              <CategoryChip label={t('ai.women')} selected={gender === 'female'} onPress={() => setGender('female')} />
              <CategoryChip label={t('ai.men')} selected={gender === 'male'} onPress={() => setGender('male')} />
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8 }}>
              <CategoryChip label={t('ai.all')} selected={!interest} onPress={() => setInterest(null)} />
              {cats.filter((c) => c.id !== 'surprise').map((c) => <CategoryChip key={c.id} label={`${c.emoji} ${catName(c)}`} selected={interest === c.id} onPress={() => setInterest(c.id)} />)}
            </ScrollView>
            {error && <Text style={[s.sub, { color: colors.danger }]}>{error}</Text>}
            {!items && <ActivityIndicator color={colors.text} style={{ marginTop: 30 }} />}
          </View>
        }
        renderItem={({ item }) => <CompanionTile c={item} width={w} onPress={() => router.push({ pathname: '/companion/[id]', params: { id: item.id } })} />} />
    </Screen>
  );
}
const s = StyleSheet.create({ sub: { marginHorizontal: 20, fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted, lineHeight: 19 } });
