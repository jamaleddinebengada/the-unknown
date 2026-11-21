import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { BottomSheet, useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { EmptyState, PremiumButton, T } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/lib/supabase';
import { deleteMyAccount, getBlockedUsers, unblockUser, updateMyProfile } from '@/services/api';
import { signOut } from '@/services/auth';
import { unknownName } from '@/utils/format';

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <T v="overline" color={colors.textMuted}>{title}</T>
      <View style={s.group}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value, onPress, danger, right }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress?: () => void; danger?: boolean; right?: ReactNode }) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress} disabled={!onPress && !right}
      style={({ pressed }) => [s.row, pressed && onPress && { backgroundColor: colors.elevated }]}>
      <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.textSecondary} />
      <T style={{ flex: 1 }} color={danger ? colors.danger : colors.text}>{label}</T>
      {value && <T v="caption" color={colors.textMuted}>{value}</T>}
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const { profile, refreshProfile, session } = useAuth();
  const [blockedOpen, setBlockedOpen] = useState(false);
  const [guidelines, setGuidelines] = useState(false);
  const [blocked, setBlocked] = useState<Awaited<ReturnType<typeof getBlockedUsers>>>([]);

  const loadBlocked = useCallback(() => getBlockedUsers().then(setBlocked).catch(() => {}), []);
  useEffect(() => { if (blockedOpen) loadBlocked(); }, [blockedOpen, loadBlocked]);

  const toggle = async (key: 'show_age' | 'show_country' | 'show_online', v: boolean) => {
    try { await updateMyProfile({ [key]: v }); await refreshProfile(); } catch (e) { toast(friendlyError(e), 'error'); }
  };
  const setWhoCanMessage = async (v: 'approved' | 'nobody') => {
    try { await updateMyProfile({ who_can_message: v }); await refreshProfile(); } catch (e) { toast(friendlyError(e), 'error'); }
  };

  const confirmDelete = () => Alert.alert('Delete your account?', 'Your profile, posts, messages and connections are permanently deleted. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete forever', style: 'destructive', onPress: async () => {
      try { await deleteMyAccount(); await signOut(); router.replace('/'); } catch (e) { toast(friendlyError(e), 'error'); }
    } },
  ]);

  const sw = (v: boolean, on: (x: boolean) => void) => <Switch value={v} onValueChange={on} trackColor={{ true: colors.violet, false: colors.elevated }} />;

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Settings" />
      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.xl, paddingBottom: 60 }}>
        <Group title="ACCOUNT">
          <Row icon="person-outline" label="Edit profile" onPress={() => router.push('/edit-profile')} />
          <Row icon="mail-outline" label="Email" value={session?.user.email ?? '—'} />
          <Row icon="finger-print-outline" label="Public identity" value={unknownName(profile?.unknown_number)} />
        </Group>

        <Group title="PRIVACY">
          <Row icon="calendar-outline" label="Show age" right={sw(!!profile?.show_age, (v) => toggle('show_age', v))} />
          <Row icon="flag-outline" label="Show country" right={sw(!!profile?.show_country, (v) => toggle('show_country', v))} />
          <Row icon="radio-outline" label="Show online status" right={sw(!!profile?.show_online, (v) => toggle('show_online', v))} />
          <Row icon="chatbubble-ellipses-outline" label="Mystery Matches"
            right={sw(profile?.who_can_message !== 'nobody', (v) => setWhoCanMessage(v ? 'approved' : 'nobody'))} />
          <View style={{ paddingHorizontal: 14, paddingBottom: 12 }}>
            <T v="caption" color={colors.textMuted}>Nobody can message you without your approval. Conversations only open when you accept interest or a Mystery Match.</T>
          </View>
        </Group>

        <Group title="SAFETY">
          <Row icon="ban-outline" label="Blocked users" onPress={() => setBlockedOpen(true)} />
          <Row icon="document-text-outline" label="Community guidelines" onPress={() => setGuidelines(true)} />
        </Group>

        <View style={{ gap: spacing.sm }}>
          <PremiumButton label="Sign out" icon="log-out-outline" onPress={() => signOut().then(() => router.replace('/'))} />
          <PremiumButton tone="danger" label="Delete account" icon="trash-outline" onPress={confirmDelete} />
        </View>
      </ScrollView>

      <BottomSheet visible={guidelines} onClose={() => setGuidelines(false)} title="Community guidelines">
        <View style={{ gap: 10 }}>
          {[
            'Adults only. You must be 18 or older.',
            'Anonymous never means consequence-free. Harassment, threats, hate and scams lead to suspension or a ban.',
            'Never pressure anyone to reveal their identity, photos or contact details.',
            'No sexual content, no spam, no selling.',
            'Report anything that feels wrong — reports are anonymous and reviewed by people.',
          ].map((r) => (
            <View key={r} style={{ flexDirection: 'row', gap: 10 }}>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.violetSoft} />
              <T style={{ flex: 1 }}>{r}</T>
            </View>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet visible={blockedOpen} onClose={() => setBlockedOpen(false)} title="Blocked users">
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
  group: { borderRadius: radius.lg, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, minHeight: 52 },
});
