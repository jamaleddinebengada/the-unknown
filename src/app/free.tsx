import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { GradientButton, IconButton, TextField } from '@/components/ui';
import { CategoryTile, Chip } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t, type TKey } from '@/i18n';
import { goFree } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/supabase';
import { useCategories } from '@/lib/useCategories';
import { haptic } from '@/utils/format';

const DURATIONS = [['30m', 30], ['1h', 60], ['2h', 120], ['4h', 240], ['tonight', -1], ['allDay', -2]] as const;
const DISTANCES = [2, 5, 10, 25, 50];

/** End of the chosen window: minutes from now, until 23:59 tonight, or 12 h. */
function untilFor(key: number): Date {
  const now = new Date();
  if (key === -1) { const d = new Date(now); d.setHours(23, 59, 0, 0); return d.getTime() - now.getTime() < 30 * 60000 ? new Date(now.getTime() + 60 * 60000) : d; }
  if (key === -2) return new Date(now.getTime() + 12 * 3600000);
  return new Date(now.getTime() + key * 60000);
}

/** "I'm free now": what, how long, how far, one or group, budget — expires automatically. */
export default function Free() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { boot, refresh } = useAuth();
  const { list } = useCategories();
  const [cats, setCats] = useState<string[]>([]);
  const [dur, setDur] = useState<number>(120);
  const [km, setKm] = useState(10);
  const [group, setGroup] = useState<'one' | 'group' | 'any'>('any');
  const [budget, setBudget] = useState<'free' | 'low' | 'medium' | 'any'>('any');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async () => {
    if (!boot?.zone?.enabled) { toast(friendlyError(new Error('location_off')), 'error'); router.replace('/location'); return; }
    setBusy(true);
    try {
      await goFree({ categories: cats, until: untilFor(dur), maxKm: km, group, budget, note });
      haptic.success();
      await refresh();
      toast(t('free.live'), 'success');
      router.replace('/(tabs)/radar');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.white }}>
      <View style={[s.head, { paddingTop: insets.top + 6 }]}>
        <IconButton name="close" label={t('common.cancel')} onPress={() => router.back()} />
        <Text style={s.title}>⚡ {t('free.title')}</Text>
        <View style={{ width: 42 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14, paddingBottom: 30 }}>
        <Text style={s.q}>{t('free.what')}</Text>
        <View style={s.grid}>
          {list.map((c) => <CategoryTile key={c.id} c={c} size={64} selected={cats.includes(c.id)} onPress={() => setCats((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : x.length >= 5 ? x : [...x, c.id]))} />)}
        </View>
        <Text style={s.q}>{t('free.howLong')}</Text>
        <View style={s.wrap}>{DURATIONS.map(([k, v]) => <Chip key={k} label={t(`free.${k}` as TKey)} on={dur === v} onPress={() => setDur(v)} />)}</View>
        <Text style={s.q}>{t('free.howFar')}</Text>
        <View style={s.wrap}>{DISTANCES.map((d) => <Chip key={d} label={`${d} km`} on={km === d} onPress={() => setKm(d)} />)}</View>
        <Text style={s.q}>{t('free.who')}</Text>
        <View style={s.wrap}>{(['one', 'group', 'any'] as const).map((g) => <Chip key={g} label={t(`free.${g}` as TKey)} on={group === g} onPress={() => setGroup(g)} />)}</View>
        <Text style={s.q}>{t('free.budget')}</Text>
        <View style={s.wrap}>{(['free', 'low', 'medium', 'any'] as const).map((b) => <Chip key={b} label={t(`free.b.${b}` as TKey)} on={budget === b} onPress={() => setBudget(b)} />)}</View>
        <Text style={s.q}>{t('free.note')}</Text>
        <TextField value={note} onChangeText={setNote} maxLength={140} placeholder={t('free.notePlaceholder')} />
      </ScrollView>
      <View style={[s.foot, { paddingBottom: insets.bottom + 12 }]}>
        <GradientButton icon="flash" label={t('free.go')} loading={busy} disabled={cats.length === 0} onPress={go} />
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  title: { fontFamily: fonts.extrabold, fontSize: 20, color: colors.text },
  q: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, marginTop: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  foot: { paddingHorizontal: 20, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
