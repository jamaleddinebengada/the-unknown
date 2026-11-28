import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { Label, SetupFrame } from '@/components/Setup';
import { GradientButton } from '@/components/ui';
import { CategoryTile, Chip } from '@/components/wif';
import { LANGUAGES } from '@/constants/languages';
import { t } from '@/i18n';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/supabase';
import { useCategories } from '@/lib/useCategories';


/** Step 2: favourite activities (≥3) and languages. */
export default function SetupInterests() {
  const router = useRouter();
  const toast = useToast();
  const { boot } = useAuth();
  const { list } = useCategories();
  const [picked, setPicked] = useState<string[]>(boot?.profile.interests ?? []);
  const [langs, setLangs] = useState<string[]>(boot?.profile.languages?.length ? boot.profile.languages : []);
  const [busy, setBusy] = useState(false);
  const toggle = (arr: string[], set: (x: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  const save = async () => {
    setBusy(true);
    try { await updateProfile({ interests: picked, languages: langs }); router.push('/setup/location'); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <SetupFrame step={2} title={t('setup.interestsTitle')} subtitle={t('setup.interestsHint')}
      footer={<GradientButton label={`${t('common.continue')} · ${picked.length}`} arrow loading={busy} disabled={picked.length < 3 || langs.length === 0} onPress={save} />}>
      <View style={s.grid}>
        {list.filter((c) => c.id !== 'surprise').map((c) => <CategoryTile key={c.id} c={c} size={70} selected={picked.includes(c.id)} onPress={() => toggle(picked, setPicked, c.id)} />)}
      </View>
      <Label>{t('setup.languages')}</Label>
      <View style={s.wrap}>{LANGUAGES.map((l) => <Chip key={l.code} label={l.label} on={langs.includes(l.code)} onPress={() => toggle(langs, setLangs, l.code)} />)}</View>
    </SetupFrame>
  );
}
const s = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
