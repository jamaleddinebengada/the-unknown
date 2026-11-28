import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { colors, fonts } from '@/constants/theme';
import { getLanguage, LANGS, t, type TKey } from '@/i18n';
import { deleteAccount, updateProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { friendlyError } from '@/lib/supabase';

function Row({ icon, label, value, onPress, danger }: { icon: keyof typeof Ionicons.glyphMap; label: string; value?: string; onPress: () => void; danger?: boolean }) {
return (
  <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.bg }]} accessibilityRole="button">
    <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.text} />
    <Text style={[s.label, danger && { color: colors.danger }]}>{label}</Text>
    {!!value && <Text style={s.value} numberOfLines={1}>{value}</Text>}
    {!danger && <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />}
  </Pressable>
);
}

export default function Settings() {
  const router = useRouter();
  const toast = useToast();
  const { boot, refresh, signOut } = useAuth();
  const [disc, setDisc] = useState(boot?.profile.discoverable ?? true);
  return (
    <Screen>
      <StackHeader title={t('settings.title')} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={s.group}>
          <Row icon="language" label={t('settings.language')} value={LANGS.find((l) => l.code === getLanguage())?.native} onPress={() => router.push('/language')} />
          <Row icon="navigate" label={t('settings.location')} value={boot?.zone?.enabled ? boot.zone.city ?? '✓' : t('settings.locationOff')} onPress={() => router.push('/location')} />
          <View style={s.row}>
            <Ionicons name="eye" size={20} color={colors.text} />
            <Text style={s.label}>{t('settings.discoverable')}</Text>
            <Switch value={disc} trackColor={{ true: colors.primaryDeep, false: colors.border }} thumbColor="#fff"
              onValueChange={async (v) => { setDisc(v); try { await updateProfile({ discoverable: v }); refresh(); } catch (e) { setDisc(!v); toast(friendlyError(e), 'error'); } }} />
          </View>
          <Row icon="ban" label={t('settings.blocked')} onPress={() => router.push('/blocked')} />
        </View>
        <View style={s.group}>
          {(['terms', 'privacy', 'guidelines'] as const).map((d) => <Row key={d} icon="document-text-outline" label={t(`settings.${d}` as TKey)} onPress={() => router.push({ pathname: '/legal/[doc]', params: { doc: d } })} />)}
          <Row icon="shield-checkmark-outline" label={t('profile.safety')} onPress={() => router.push('/safety')} />
        </View>
        <View style={s.group}>
          <Row icon="log-out-outline" label={t('settings.signOut')} onPress={() => signOut().then(() => router.replace('/'))} />
          <Row icon="trash-outline" danger label={t('settings.delete')} onPress={() => Alert.alert(t('settings.delete'), t('settings.deleteBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.delete'), style: 'destructive', onPress: async () => { try { await deleteAccount(); await signOut(); router.replace('/'); } catch (e) { toast(friendlyError(e), 'error'); } } },
          ])} />
        </View>
        <Text style={s.version}>WhoIsFree · {t('app.slogan')}</Text>
      </ScrollView>
    </Screen>
  );
}
const s = StyleSheet.create({
  group: { borderRadius: 20, backgroundColor: colors.white, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairline },
  label: { flex: 1, fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  value: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.textMuted, maxWidth: 140 },
  version: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
});
