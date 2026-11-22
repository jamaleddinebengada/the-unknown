import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useToast } from '@/components/Overlay';
import { Scenery } from '@/components/Scenery';
import { Screen, StackHeader } from '@/components/Screen';
import { Choice, Group, Row, Toggle } from '@/components/SettingsUI';
import { GradientButton, T, TextField } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { usePlan } from '@/features/membership/usePlan';
import { PROFILE_THEMES } from '@/features/profile/ProfileHeader';
import { friendlyError } from '@/lib/supabase';
import { updateMyProfile, type ProfileUpdate } from '@/services/api';
import { getMyIdentity, saveMyIdentity } from '@/services/identity';
import { invalidateMeta } from '@/services/photos';
import type { Profile } from '@/types/models';
import { unknownName } from '@/utils/format';

/** Identity & Privacy — anonymity, mutual reveal, photo visibility, contact rules, VIP themes. */
export default function Privacy() {
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { profile, refreshProfile } = useAuth();
  const plan = usePlan();
  const [identity, setIdentity] = useState({ display_name: '', social_handle: '', about: '' });
  const [savingId, setSavingId] = useState(false);

  useEffect(() => {
    getMyIdentity().then((i) => i && setIdentity({ display_name: i.display_name ?? '', social_handle: i.social_handle ?? '', about: i.about ?? '' })).catch(() => {});
  }, []);

  const patch = async (p: ProfileUpdate) => {
    try { await updateMyProfile(p); await refreshProfile(); invalidateMeta(); } catch (e) { toast(friendlyError(e), 'error'); }
  };
  const saveIdentity = async () => {
    setSavingId(true);
    try {
      await saveMyIdentity({ display_name: identity.display_name.trim() || null, social_handle: identity.social_handle.trim() || null, about: identity.about.trim() || null });
      toast('Private identity saved. Only shared when you both agree.', 'success');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setSavingId(false); }
  };
  const vip = plan?.tier === 'vip';
  if (!profile) return null;

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Identity & Privacy" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 0 }}>
        <Animated.View entering={FadeInDown.springify().damping(18)}>
          <Group>
            <Row icon="shield-half-outline" label="Stay Anonymous" sub={`Others see you as ${unknownName(profile.unknown_number)} — never your name`} right={<Text style={{ fontSize: 18 }}>✅</Text>} />
            <Row icon="eye-outline" label="Reveal Identity" sub="Only in a chat, only when you both agree, only what you choose" last />
          </Group>
        </Animated.View>

        <Group title="WHO CAN SEE MY PHOTOS">
          <Choice<Profile['photo_visibility']> value={profile.photo_visibility ?? 'revealed'} onChange={(v) => patch({ photo_visibility: v })} options={[
            { value: 'revealed', label: 'After a mutual reveal', sub: 'Recommended — strangers see the mask until you both agree' },
            { value: 'public', label: 'Everyone', sub: 'Your photos appear on your profile, in People and Mystery Match' },
            { value: 'hidden', label: 'Nobody', sub: 'Keep photos private, even after a reveal' },
          ]} />
        </Group>

        <Group title="WHO CAN CONTACT YOU">
          <Choice<Profile['who_can_message']> value={profile.who_can_message} onChange={(v) => patch({ who_can_message: v })} options={[
            { value: 'approved', label: 'People I approve', sub: 'Interest requests and matches you accept' },
            { value: 'nobody', label: 'Nobody for now', sub: 'Pause new matches and requests' },
          ]} />
        </Group>

        <Group title="VISIBILITY">
          <Row icon="flag-outline" label="Show my country" right={<Toggle label="Show my country" value={profile.show_country} onChange={(v) => patch({ show_country: v })} />} />
          <Row icon="calendar-outline" label="Show my age" right={<Toggle label="Show my age" value={profile.show_age} onChange={(v) => patch({ show_age: v })} />} />
          <Row icon="radio-outline" label="Show when I'm online" right={<Toggle label="Show online status" value={profile.show_online} onChange={(v) => patch({ show_online: v })} />} last />
        </Group>

        <View style={{ gap: 8 }}>
          <T v="overline" color={colors.textMuted}>PRIVATE IDENTITY (SHARED ONLY ON MUTUAL REVEAL)</T>
          <View style={s.card}>
            <TextField label="Name" value={identity.display_name} onChangeText={(t) => setIdentity((i) => ({ ...i, display_name: t }))} maxLength={60} placeholder="How you'd like to be called" />
            <TextField label="Social handle" value={identity.social_handle} onChangeText={(t) => setIdentity((i) => ({ ...i, social_handle: t }))} maxLength={80} placeholder="@yourname (optional)" autoCapitalize="none" />
            <TextField label="About you" value={identity.about} onChangeText={(t) => setIdentity((i) => ({ ...i, about: t }))} maxLength={300} multiline placeholder="A few words for people you trust" />
            <GradientButton small label="Save private identity" loading={savingId} onPress={saveIdentity} />
          </View>
        </View>

        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <T v="overline" color={colors.textMuted}>PROFILE THEME</T>
            {!vip && <T v="caption" color={colors.gold} style={{ fontFamily: fonts.bold }}>VIP</T>}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {Object.entries(PROFILE_THEMES).map(([key, t]) => {
              const on = profile.profile_theme === key;
              const locked = key !== 'rose' && !vip;
              return (
                <View key={key} style={{ alignItems: 'center', gap: 6 }}>
                  <GradientSwatch colors={t.colors} on={on} locked={locked}
                    onPress={() => (locked ? router.push('/premium') : patch({ profile_theme: key as Profile['profile_theme'] }))} />
                  <T v="caption" color={on ? colors.violetDeep : colors.textSecondary}>{t.label}</T>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <Group>
          <Row icon="ban-outline" label="Block & Report" sub="Always free. Open a profile or message to report." onPress={() => router.push('/settings')} last />
        </Group>
        <Scenery width={width} height={180} flowers="bottom" style={{ marginHorizontal: -spacing.md }} />
      </ScrollView>
    </Screen>
  );
}

function GradientSwatch({ colors: c, on, locked, onPress }: { colors: [string, string]; on: boolean; locked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: on }} style={[s.swatchWrap, on && { borderColor: colors.violet }]}>
      <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.swatch}>
        {locked && <Text style={{ fontSize: 16 }}>🔒</Text>}
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: 26, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  swatchWrap: { padding: 3, borderRadius: 36, borderWidth: 2, borderColor: 'transparent' },
  swatch: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
});
