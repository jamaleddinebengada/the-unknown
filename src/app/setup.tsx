import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { PhotoSourceSheet } from '@/features/profile/PhotoSourceSheet';
import { pickPhoto, type PhotoSource } from '@/lib/media';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { CategoryChip, GradientButton, IconButton, T, TextField } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { LOOKING_FOR, parseBirthDate } from '@/features/profile/ProfileForm';
import { friendlyError } from '@/lib/supabase';
import { updateMyProfile } from '@/services/api';
import { setProfilePhoto } from '@/services/photos';
import { haptic } from '@/utils/format';

const GENDERS = [{ key: 'woman', label: 'Woman' }, { key: 'man', label: 'Man' }, { key: 'nonbinary', label: 'Non-binary' }, { key: 'other', label: 'Other' }];
const SEEKING = [{ key: 'woman', label: 'Women' }, { key: 'man', label: 'Men' }, { key: 'nonbinary', label: 'Non-binary' }];

/** Profile setup: name (optional), date of birth (18+, required), gender, who to meet, photo. */
export default function Setup() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const bd = profile?.birth_date?.split('-') ?? [];
  const [name, setName] = useState(profile?.display_name ?? '');
  const [dob, setDob] = useState({ d: bd[2] ?? '', m: bd[1] ?? '', y: bd[0] ?? '' });
  const [gender, setGender] = useState<string | null>(profile?.gender ?? null);
  const [seeking, setSeeking] = useState<string[]>(profile?.interested_in ?? []);
  const [looking, setLooking] = useState<string | null>(profile?.looking_for ?? null);
  const [photo, setPhoto] = useState<{ uri: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState(false);
  const [showPhoto, setShowPhoto] = useState(true);

  const pick = async (src: PhotoSource) => {
    try { const img = await pickPhoto(src); if (img) setPhoto(img); } catch (e) { toast(friendlyError(e), 'error'); }
  };
  const next = async () => {
    const birth = parseBirthDate(dob.d, dob.m, dob.y);
    if (name.trim().length < 2) { toast('Choose a name or nickname (2+ letters).', 'error'); return; }
    if (!birth.value) { toast(birth.error ?? 'Enter your date of birth — THE UNKNOWN is for adults 18+.', 'error'); return; }
    setBusy(true);
    try {
      await updateMyProfile({ display_name: name.trim(), birth_date: birth.value, gender, interested_in: seeking, looking_for: looking as 'friendship' | 'conversation' | 'relationship' | null, show_age: true,
        ...(photo ? { photo_visibility: showPhoto ? 'public' as const : 'revealed' as const } : {}) });
      if (photo) await setProfilePhoto(photo.uri, photo.mime).catch((e) => toast(`Photo not saved: ${friendlyError(e)}`, 'error'));
      await refreshProfile();
      haptic.success();
      router.push('/vibe');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 6, padding: spacing.lg, gap: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton label="Back" name="chevron-back" onPress={() => router.back()} />
          <View style={{ flex: 1 }} />
          <T v="caption" color={colors.textMuted}>Step 1 of 2</T>
        </View>
        <Text style={s.title}>Create your profile</Text>
        <Pressable onPress={() => setSource(true)} accessibilityRole="button" accessibilityLabel="Add a profile photo" style={s.photo}>
          {photo ? <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : (
            <View style={{ alignItems: 'center', gap: 6 }}><Ionicons name="camera" size={30} color={colors.primary} /><T v="caption" color={colors.primary} style={{ fontFamily: fonts.semibold }}>Add photo</T></View>
          )}
        </Pressable>
        {photo ? (
          <View style={s.toggle}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleTitle}>Show my photo in Nearby</Text>
              <T v="caption" color={colors.textMuted}>{showPhoto ? 'Recommended — people see your photo on your card.' : 'Anonymous mode: shown only after a mutual reveal.'}</T>
            </View>
            <Switch value={showPhoto} onValueChange={setShowPhoto} trackColor={{ true: colors.primary, false: colors.border }} thumbColor="#fff" />
          </View>
        ) : (
          <T v="caption" color={colors.textMuted} style={{ textAlign: 'center', marginTop: -8 }}>Add a real photo of yourself — profiles with a photo get many more replies. You can add up to 6 later.</T>
        )}

        <Field label="Name or nickname" hint="Shown on your profile instead of a number.">
          <TextField value={name} onChangeText={setName} maxLength={30} placeholder="e.g. Sara" accessibilityLabel="Name" />
        </Field>
        <Field label="Date of birth" hint="Required. You must be 18 or older. Only your age is shown.">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}><TextField value={dob.d} onChangeText={(t) => setDob((x) => ({ ...x, d: t.replace(/\D/g, '').slice(0, 2) }))} placeholder="DD" keyboardType="number-pad" accessibilityLabel="Day" /></View>
            <View style={{ flex: 1 }}><TextField value={dob.m} onChangeText={(t) => setDob((x) => ({ ...x, m: t.replace(/\D/g, '').slice(0, 2) }))} placeholder="MM" keyboardType="number-pad" accessibilityLabel="Month" /></View>
            <View style={{ flex: 1.4 }}><TextField value={dob.y} onChangeText={(t) => { const y = t.replace(/\D/g, '').slice(0, 4); setDob((x) => ({ ...x, y })); if (y.length === 4) Keyboard.dismiss(); }} placeholder="YYYY" keyboardType="number-pad" accessibilityLabel="Year" /></View>
          </View>
        </Field>
        <Field label="I am">
          <View style={s.wrap}>{GENDERS.map((g) => <CategoryChip key={g.key} label={g.label} selected={gender === g.key} onPress={() => setGender(gender === g.key ? null : g.key)} />)}</View>
        </Field>
        <Field label="Show me">
          <View style={s.wrap}>{SEEKING.map((g) => { const on = seeking.includes(g.key); return <CategoryChip key={g.key} label={g.label} selected={on} onPress={() => setSeeking(on ? seeking.filter((x) => x !== g.key) : [...seeking, g.key])} />; })}</View>
        </Field>
        <Field label="Looking for">
          <View style={s.wrap}>{LOOKING_FOR.map((l) => <CategoryChip key={l.key} label={l.label} selected={looking === l.key} onPress={() => setLooking(looking === l.key ? null : l.key)} />)}</View>
        </Field>
      </ScrollView>
      <PhotoSourceSheet visible={source} onClose={() => setSource(false)} onPick={pick} title="Profile photo" />
      <View style={[s.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <GradientButton label="Continue" arrow loading={busy} onPress={next} />
      </View>
    </KeyboardAvoidingView>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <View><Text style={s.label}>{label}</Text>{hint && <T v="caption" color={colors.textMuted}>{hint}</T>}</View>
      {children}
    </View>
  );
}

const s = StyleSheet.create({
  title: { fontFamily: fonts.extrabold, fontSize: 28, letterSpacing: -0.6, color: colors.text },
  photo: { alignSelf: 'center', width: 132, height: 165, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.primary },
  label: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, marginTop: -6 },
  toggleTitle: { fontFamily: fonts.semibold, fontSize: 14, color: colors.text },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: 12, backgroundColor: 'rgba(248,250,252,0.96)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
