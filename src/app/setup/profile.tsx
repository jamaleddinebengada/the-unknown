import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { PhotoSourceSheet } from '@/components/PhotoSource';
import { Label, SetupFrame } from '@/components/Setup';
import { GradientButton, TextField } from '@/components/ui';
import { Chip } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t, type TKey } from '@/i18n';
import { updateProfile, uploadPhoto } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { pickPhoto, type PhotoSource } from '@/lib/media';
import { friendlyError, photoUrl } from '@/lib/supabase';

const GENDERS = ['woman', 'man', 'nonbinary', 'other'] as const;

/** Step 1: photo, name, date of birth (18+), gender, bio. */
export default function SetupProfile() {
  const router = useRouter();
  const toast = useToast();
  const { boot, signOut } = useAuth();
  const p = boot?.profile;
  const [photo, setPhoto] = useState<string | null>(p?.photo_path ?? null);
  const [uploading, setUploading] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [name, setName] = useState(p?.display_name ?? '');
  const bd = p?.birth_date?.split('-') ?? [];
  const [day, setDay] = useState(bd[2] ?? ''); const [month, setMonth] = useState(bd[1] ?? ''); const [year, setYear] = useState(bd[0] ?? '');
  const [gender, setGender] = useState<string | null>(p?.gender ?? null);
  const [bio, setBio] = useState(p?.bio ?? '');
  const [busy, setBusy] = useState(false);

  const pick = async (src: PhotoSource) => {
    try {
      const img = await pickPhoto(src);
      if (!img) return;
      setUploading(true);
      const path = await uploadPhoto(img.uri, img.mime, 'main');
      await updateProfile({ photo_path: path });
      setPhoto(path);
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setUploading(false); }
  };

  const save = async () => {
    const d = Number(day), m = Number(month), y = Number(year);
    const date = new Date(Date.UTC(y, m - 1, d));
    if (name.trim().length < 2) { toast(t('setup.name'), 'error'); return; }
    if (!y || !m || !d || date.getUTCDate() !== d || y < 1900) { toast(t('setup.dobHint'), 'error'); return; }
    const adult = new Date(); adult.setFullYear(adult.getFullYear() - 18);
    if (date > adult) { toast(friendlyError(new Error('under_18')), 'error'); return; }
    setBusy(true);
    try {
      await updateProfile({ display_name: name.trim(), birth_date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, gender, bio: bio.trim() || null });
      router.push('/setup/interests');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <SetupFrame step={1} title={t('setup.title')} back={false}
      footer={<GradientButton label={t('common.continue')} arrow loading={busy} onPress={save} />}>
      <Pressable onPress={() => setSheet(true)} accessibilityRole="button" accessibilityLabel={t('setup.photo')} style={s.photo}>
        {photo ? <Image source={{ uri: photoUrl(photo) }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
          <View style={{ alignItems: 'center', gap: 6 }}><View style={s.cam}><Ionicons name="camera" size={24} color={colors.text} /></View><Text style={s.photoText}>{t('setup.photo')}</Text></View>
        )}
        {uploading && <View style={s.uploading}><ActivityIndicator color={colors.text} /></View>}
      </Pressable>
      <Text style={s.hint}>{t('setup.photoHint')}</Text>
      <Label>{t('setup.name')}</Label>
      <TextField value={name} onChangeText={setName} maxLength={30} placeholder="Sara" accessibilityLabel="Name" />
      <Label hint={t('setup.dobHint')}>{t('setup.dob')}</Label>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><TextField value={day} onChangeText={(x) => setDay(x.replace(/\D/g, '').slice(0, 2))} placeholder="DD" keyboardType="number-pad" accessibilityLabel="Day" /></View>
        <View style={{ flex: 1 }}><TextField value={month} onChangeText={(x) => setMonth(x.replace(/\D/g, '').slice(0, 2))} placeholder="MM" keyboardType="number-pad" accessibilityLabel="Month" /></View>
        <View style={{ flex: 1.4 }}><TextField value={year} onChangeText={(x) => setYear(x.replace(/\D/g, '').slice(0, 4))} placeholder="YYYY" keyboardType="number-pad" accessibilityLabel="Year" /></View>
      </View>
      <Label>{t('setup.gender')}</Label>
      <View style={s.wrap}>{GENDERS.map((g) => <Chip key={g} label={t(`setup.${g}` as TKey)} on={gender === g} onPress={() => setGender(gender === g ? null : g)} />)}</View>
      <Label>{t('setup.bio')}</Label>
      <TextField value={bio} onChangeText={setBio} maxLength={300} multiline placeholder="☕ 🎾 ✈️" style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <Text onPress={signOut} style={s.out}>{t('settings.signOut')}</Text>
      <PhotoSourceSheet visible={sheet} onClose={() => setSheet(false)} onPick={pick} />
    </SetupFrame>
  );
}
const s = StyleSheet.create({
  photo: { alignSelf: 'center', width: 150, height: 186, borderRadius: 24, backgroundColor: colors.cream, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primaryDeep, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cam: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  photoText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, textAlign: 'center', paddingHorizontal: 10 },
  uploading: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.6)', alignItems: 'center', justifyContent: 'center' },
  hint: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted, textAlign: 'center', marginTop: -6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  out: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted, textAlign: 'center', padding: 8 },
});
