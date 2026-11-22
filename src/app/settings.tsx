import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { MaskLogo } from '@/components/Brand';
import { BottomSheet, useToast } from '@/components/Overlay';
import { Scenery } from '@/components/Scenery';
import { Screen, StackHeader } from '@/components/Screen';
import { Group, Row } from '@/components/SettingsUI';
import { EmptyState, PremiumButton, T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { TIER_LABEL, usePlan } from '@/features/membership/usePlan';
import { friendlyError } from '@/lib/supabase';
import { deleteMyAccount, getBlockedUsers, unblockUser } from '@/services/api';
import { unknownName } from '@/utils/format';

const GUIDELINES = [
  'Adults only. You must be 18 or older.',
  'Anonymous never means consequence-free. Harassment, threats, hate and scams lead to suspension or a ban.',
  'Never pressure anyone to reveal their identity, photos or contact details.',
  'No sexual content, no spam, no selling.',
  'Report anything that feels wrong — reports are anonymous and reviewed by people.',
];

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const { profile, resetIdentity } = useAuth();
  const plan = usePlan();
  const [sheet, setSheet] = useState<null | 'blocked' | 'guidelines' | 'about' | 'account'>(null);
  const [blocked, setBlocked] = useState<Awaited<ReturnType<typeof getBlockedUsers>>>([]);

  const loadBlocked = useCallback(() => getBlockedUsers().then(setBlocked).catch(() => {}), []);
  useEffect(() => { if (sheet === 'blocked') loadBlocked(); }, [sheet, loadBlocked]);

  const confirmDelete = () => Alert.alert('Delete all your data?', 'Your anonymous profile, photos, posts, messages and connections are permanently deleted. This cannot be undone. An active store subscription must be cancelled in your store settings.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete forever', style: 'destructive', onPress: async () => {
      try { await deleteMyAccount(); await resetIdentity(); toast('Your data was deleted. You now have a new anonymous identity.', 'success'); router.replace('/discover'); } catch (e) { toast(friendlyError(e), 'error'); }
    } },
  ]);
  const newIdentity = () => Alert.alert('Start over with a new identity?', 'You will get a new UNKNOWN number. Your current conversations stay with the old identity and cannot be recovered.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Start over', style: 'destructive', onPress: () => resetIdentity().then(() => { toast('Welcome, new stranger.', 'success'); router.replace('/discover'); }) },
  ]);

  const tier = plan?.tier ?? 'free';
  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.lg, paddingBottom: 0 }}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/premium')} style={s.sub}>
          <Text style={{ fontSize: 26 }}>👑</Text>
          <View style={{ flex: 1 }}>
            <T style={{ fontFamily: fonts.bold }} color={colors.violetDeep}>My Subscription</T>
            <T v="caption" color={colors.textSecondary}>
              {tier === 'free' ? 'Free · upgrade to Plus or VIP' : `${TIER_LABEL[tier]}${plan?.renews_at ? ` · renews ${new Date(plan.renews_at).toLocaleDateString()}` : ''}`}
            </T>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.violet} />
        </Pressable>

        <Group>
          <Row icon="person-outline" label="Account & Security" sub={unknownName(profile?.unknown_number)} onPress={() => setSheet('account')} />
          <Row icon="notifications-outline" label="Notifications" onPress={() => router.push('/notifications')} />
          <Row icon="shield-checkmark-outline" label="Identity & Privacy" onPress={() => router.push('/privacy')} />
          <Row icon="location-outline" label="People Nearby" onPress={() => router.push('/nearby')} />
          <Row icon="ban-outline" label="Blocked members" onPress={() => setSheet('blocked')} />
          <Row icon="medkit-outline" label="Safety Center" onPress={() => router.push('/safety')} />
          <Row icon="help-circle-outline" label="Help Center" onPress={() => router.push('/help')} />
          <Row icon="document-text-outline" label="Community Guidelines" onPress={() => setSheet('guidelines')} />
          <Row icon="information-circle-outline" label="About The Unknown" onPress={() => setSheet('about')} last />
        </Group>
        <Scenery width={width} height={190} flowers="bottom" style={{ marginHorizontal: -spacing.md, marginTop: spacing.md }} />
      </ScrollView>

      <BottomSheet visible={sheet === 'account'} onClose={() => setSheet(null)} title="Account & Security">
        <View style={{ gap: spacing.sm }}>
          <T v="caption" color={colors.textSecondary}>You use THE UNKNOWN without an email or password. Your anonymous identity is stored securely on this device.</T>
          <PremiumButton icon="create-outline" label="Edit profile" onPress={() => { setSheet(null); router.push('/edit-profile'); }} />
          <PremiumButton icon="refresh-outline" label="New anonymous identity" onPress={() => { setSheet(null); newIdentity(); }} />
          <PremiumButton tone="danger" icon="trash-outline" label="Delete my data" onPress={() => { setSheet(null); confirmDelete(); }} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'guidelines'} onClose={() => setSheet(null)} title="Community guidelines">
        <View style={{ gap: 10 }}>
          {GUIDELINES.map((r) => (
            <View key={r} style={{ flexDirection: 'row', gap: 10 }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.violet} />
              <T style={{ flex: 1 }}>{r}</T>
            </View>
          ))}
          <T v="caption" color={colors.textMuted}>To report someone, open their profile or a message and choose “Report”. Blocking and reporting are always free.</T>
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'about'} onClose={() => setSheet(null)} title="About The Unknown">
        <View style={{ alignItems: 'center', gap: 8 }}>
          <MaskLogo size={80} />
          <Text style={{ fontFamily: fonts.serif, fontSize: 24, color: colors.plum }}>THE UNKNOWN</Text>
          <T color={colors.textSecondary} style={{ textAlign: 'center' }}>Meet the unknown. Discover the unexpected.</T>
          <T v="caption" color={colors.textMuted}>Version {Constants.expoConfig?.version ?? '1.0.0'}</T>
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'blocked'} onClose={() => setSheet(null)} title="Blocked members">
        {blocked.length === 0 ? <EmptyState icon="shield-checkmark-outline" title="No one blocked" /> : blocked.map((b) => (
          <View key={b.unknown_number} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
            <AnonymousAvatar seed={b.avatar_seed} size={36} />
            <T style={{ flex: 1 }}>{unknownName(b.unknown_number)}</T>
            <PremiumButton small tone="ghost" label="Unblock" onPress={async () => { try { await unblockUser(b.unknown_number); loadBlocked(); } catch (e) { toast(friendlyError(e), 'error'); } }} />
          </View>
        ))}
      </BottomSheet>
    </Screen>
  );
}

const s = StyleSheet.create({
  sub: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: 22, backgroundColor: '#FFF6D6', borderWidth: 1.5, borderColor: 'rgba(255,128,107,0.22)' },
});
