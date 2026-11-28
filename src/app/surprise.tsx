import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { GradientButton } from '@/components/ui';
import { ActivityCard, Chip, PersonCard } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t, type TKey } from '@/i18n';
import { surprise } from '@/lib/api';
import { friendlyError } from '@/lib/supabase';
import type { Activity, Person } from '@/lib/types';
import { useCategories } from '@/lib/useCategories';

/** Picks a real activity or free people nearby that fit the time, budget and distance. Never invents anything. */
export default function Surprise() {
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { map } = useCategories();
  const [min, setMin] = useState(120);
  const [budget, setBudget] = useState('any');
  const [km, setKm] = useState(10);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{ activity: Activity | null; people: Person[] } | null>(null);
  const find = async () => {
    setBusy(true);
    try { setRes(await surprise(min, budget, km)); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Screen>
      <StackHeader title={`✨ ${t('surprise.title')}`} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 12, paddingBottom: 40 }}>
        <Text style={s.q}>{t('surprise.time')}</Text>
        <View style={s.wrap}>{([['free.1h', 60], ['free.2h', 120], ['free.4h', 240], ['free.allDay', 720]] as const).map(([k, v]) => <Chip key={k} label={t(k as TKey)} on={min === v} onPress={() => setMin(v)} />)}</View>
        <Text style={s.q}>{t('free.budget')}</Text>
        <View style={s.wrap}>{(['free', 'low', 'medium', 'any'] as const).map((b) => <Chip key={b} label={t(`free.b.${b}` as TKey)} on={budget === b} onPress={() => setBudget(b)} />)}</View>
        <Text style={s.q}>{t('free.howFar')}</Text>
        <View style={s.wrap}>{[5, 10, 25, 50].map((d) => <Chip key={d} label={`${d} km`} on={km === d} onPress={() => setKm(d)} />)}</View>
        <GradientButton icon="sparkles" label={t('surprise.find')} loading={busy} onPress={find} style={{ marginTop: 8 }} />
        {busy && <ActivityIndicator color={colors.text} />}
        {res && !res.activity && res.people.length === 0 && <Animated.Text entering={FadeInDown} style={s.none}>{t('surprise.nothing')}</Animated.Text>}
        {res?.activity && (
          <Animated.View entering={ZoomIn.springify()}>
            <ActivityCard a={res.activity} cat={map.get(res.activity.category)} onPress={() => router.push({ pathname: '/activity/[id]', params: { id: res.activity!.id } })} />
            <Text style={s.safety}>🛡️ {t('act.safety')}</Text>
          </Animated.View>
        )}
        {!!res?.people.length && (
          <View style={{ gap: 10 }}>
            <Text style={s.q}>{t('surprise.people')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {res.people.map((p) => <PersonCard key={p.id} p={p} width={(width - 52) / 2} cats={map} onPress={() => router.push({ pathname: '/person/[id]', params: { id: p.id } })} />)}
            </View>
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}
const s = StyleSheet.create({
  q: { fontFamily: fonts.extrabold, fontSize: 16, color: colors.text, marginTop: 4 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  none: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted, textAlign: 'center', marginTop: 10 },
  safety: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textMuted, marginTop: 8 },
});
