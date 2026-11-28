import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CitySheet } from '@/components/CitySheet';
import { useToast } from '@/components/Overlay';
import { SetupFrame } from '@/components/Setup';
import { GradientButton, PremiumButton } from '@/components/ui';
import { Radar } from '@/components/wif';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { setLocation, updateProfile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { openAppSettings, shareApproximateLocation } from '@/lib/location';
import { friendlyError } from '@/lib/supabase';

/** Step 3: approximate location (GPS or a chosen city), then the profile becomes active. */
export default function SetupLocation() {
  const router = useRouter();
  const toast = useToast();
  const { refresh } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [denied, setDenied] = useState(false);
  const [cities, setCities] = useState(false);

  const finish = async () => {
    await updateProfile({ onboarded: true });
    await refresh();
    router.replace('/home');
  };
  const useGps = async () => {
    setBusy('gps');
    try {
      const r = await shareApproximateLocation();
      if (r.ok) await finish(); else { setDenied(true); if (r.reason === 'error') toast(friendlyError(new Error('invalid_location')), 'error'); }
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  return (
    <SetupFrame step={3} title={t('setup.locationTitle')} subtitle={t('setup.locationBody')}
      footer={
        <View style={{ gap: 10 }}>
          <GradientButton icon="navigate" label={t('setup.useLocation')} loading={busy === 'gps'} onPress={useGps} />
          <PremiumButton icon="business-outline" label={t('setup.chooseCity')} onPress={() => setCities(true)} loading={busy === 'city'} />
          <Pressable onPress={() => finish().catch((e) => toast(friendlyError(e), 'error'))} style={{ alignSelf: 'center', padding: 6 }}><Text style={s.later}>{t('setup.later')}</Text></Pressable>
        </View>
      }>
      <View style={{ alignItems: 'center', paddingVertical: 10 }}><Radar size={240} people={[]} onPick={() => {}} /></View>
      <View style={s.note}><Ionicons name="shield-checkmark" size={20} color={colors.online} /><Text style={s.noteText}>{t('radar.privacy')}</Text></View>
      {denied && (
        <View style={[s.note, { backgroundColor: '#FFF4E5' }]}>
          <Ionicons name="alert-circle" size={20} color={colors.warning} />
          <Text style={s.noteText}>{t('setup.denied')}</Text>
          <Text onPress={openAppSettings} style={s.link}>{t('setup.openSettings')}</Text>
        </View>
      )}
      <CitySheet visible={cities} onClose={() => setCities(false)} onPick={async (c) => {
        setBusy('city');
        try { await setLocation(c.lat, c.lng, c.name, c.country); await finish(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
      }} />
    </SetupFrame>
  );
}
const s = StyleSheet.create({
  note: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: '#ECFDF3' },
  noteText: { flex: 1, fontFamily: fonts.medium, fontSize: 13.5, color: colors.text, lineHeight: 19 },
  link: { fontFamily: fonts.bold, fontSize: 13.5, color: colors.accent },
  later: { fontFamily: fonts.semibold, fontSize: 14, color: colors.textMuted },
});
