import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { CitySheet } from '@/components/CitySheet';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { GradientButton, PremiumButton } from '@/components/ui';
import { Radar } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { disableLocation, setLocation } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { openAppSettings, shareApproximateLocation } from '@/lib/location';
import { friendlyError } from '@/lib/supabase';

/** Refresh / change / erase the approximate area. */
export default function LocationScreen() {
  const router = useRouter();
  const toast = useToast();
  const { boot, refresh } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [cities, setCities] = useState(false);
  const [denied, setDenied] = useState(false);
  const z = boot?.zone;
  const done = async () => { await refresh(); toast('✓', 'success'); router.back(); };
  return (
    <Screen>
      <StackHeader title={t('settings.location')} />
      <View style={{ padding: 20, gap: 14 }}>
        <View style={{ alignItems: 'center' }}><Radar size={200} people={[]} onPick={() => {}} /></View>
        <Text style={s.state}>{z?.enabled ? t('settings.locationOn', { city: z.city ?? '—' }) : t('settings.locationOff')}</Text>
        <Text style={s.body}>{t('setup.locationBody')}</Text>
        <GradientButton icon="navigate" label={t('setup.useLocation')} loading={busy === 'gps'} onPress={async () => {
          setBusy('gps');
          try { const r = await shareApproximateLocation(); if (r.ok) await done(); else setDenied(true); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
        }} />
        <PremiumButton icon="business-outline" label={t('setup.chooseCity')} loading={busy === 'city'} onPress={() => setCities(true)} />
        {denied && <Text onPress={openAppSettings} style={s.link}>⚠️ {t('setup.denied')} {t('setup.openSettings')}</Text>}
        {z?.enabled && (
          <PremiumButton tone="danger" icon="power" label={t('settings.turnOff')} loading={busy === 'off'} onPress={() => Alert.alert(t('settings.turnOff'), '', [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('settings.turnOff'), style: 'destructive', onPress: async () => { setBusy('off'); try { await disableLocation(); await done(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); } } },
          ])} />
        )}
        <View style={s.note}><Ionicons name="shield-checkmark" size={18} color={colors.online} /><Text style={s.noteText}>{t('radar.privacy')}</Text></View>
      </View>
      <CitySheet visible={cities} onClose={() => setCities(false)} onPick={async (c) => {
        setBusy('city'); try { await setLocation(c.lat, c.lng, c.name, c.country); await done(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
      }} />
    </Screen>
  );
}
const s = StyleSheet.create({
  state: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, textAlign: 'center' },
  body: { fontFamily: fonts.medium, fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
  link: { fontFamily: fonts.semibold, fontSize: 13.5, color: colors.accent, textAlign: 'center' },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#ECFDF3' },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 12.5, color: colors.text },
});
