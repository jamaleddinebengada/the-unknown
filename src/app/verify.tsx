import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { GradientButton, PremiumButton, T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { friendlyError } from '@/lib/supabase';
import { getMyVerification, submitVerification, type VerificationState } from '@/services/api';
import { t, type TKey } from '@/i18n';

const GESTURES = ['peace', 'thumbs_up', 'wave', 'ok', 'point_up'] as const;

/** Selfie verification: a random gesture + a front-camera selfie, reviewed by a moderator. */
export default function Verify() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<VerificationState | null>(null);
  const [shot, setShot] = useState<{ uri: string; mime: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const gesture = useMemo(() => GESTURES[Math.floor(Math.random() * GESTURES.length)], []);

  const load = useCallback(async () => {
    try { setState(await getMyVerification()); } catch (e) { toast(friendlyError(e), 'error'); }
  }, [toast]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const take = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { toast('Camera access is needed for the selfie.', 'error'); return; }
    const r = await ImagePicker.launchCameraAsync({ cameraType: ImagePicker.CameraType.front, quality: 0.7, allowsEditing: false });
    if (!r.canceled && r.assets[0]) setShot({ uri: r.assets[0].uri, mime: r.assets[0].mimeType ?? 'image/jpeg' });
  };
  const submit = async () => {
    if (!shot) return;
    setBusy(true);
    try { await submitVerification(shot.uri, shot.mime, gesture); setShot(null); await load(); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  const req = state?.request;
  return (
    <Screen edges={['top']}>
      <StackHeader title={t('verify.title')} />
      {!state ? <ActivityIndicator color={colors.primary} style={{ marginTop: 60 }} /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 40 }}>
          <View style={s.badge}><Ionicons name="checkmark-circle" size={44} color={state.verified ? colors.primary : '#B6C6DA'} /></View>
          {state.verified ? (
            <Text style={s.h}>{t('verify.approved')}</Text>
          ) : req?.status === 'pending' ? (
            <>
              <Text style={s.h}>{t('verify.title')}</Text>
              <View style={s.note}><Ionicons name="time-outline" size={20} color={colors.primary} /><T style={{ flex: 1 }}>{t('verify.pending')}</T></View>
            </>
          ) : (
            <>
              <T color={colors.textMuted} style={{ textAlign: 'center' }}>{t('verify.body')}</T>
              {req?.status === 'rejected' && <View style={[s.note, { backgroundColor: '#FFF0F3' }]}><Ionicons name="alert-circle-outline" size={20} color={colors.coral} /><T style={{ flex: 1 }}>{t('verify.rejected', { note: req.note ?? '—' })}</T></View>}
              <View style={s.card}>
                <T v="caption" color={colors.textMuted}>{t('verify.gesture')}</T>
                <Text style={s.gesture}>{t(`verify.g.${gesture}` as TKey)}</Text>
              </View>
              {shot && <Image source={{ uri: shot.uri }} style={s.preview} contentFit="cover" accessibilityLabel="Your selfie" />}
              {shot ? (
                <>
                  <GradientButton icon="send" label={t('verify.submit')} loading={busy} onPress={submit} />
                  <PremiumButton label={t('verify.retake')} tone="ghost" onPress={take} />
                </>
              ) : <GradientButton icon="camera" label={t('verify.take')} onPress={take} />}
            </>
          )}
          <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>{t('verify.privacy')}</T>
        </ScrollView>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  badge: { alignSelf: 'center', width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  h: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, textAlign: 'center' },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: colors.primarySoft },
  card: { alignItems: 'center', gap: 6, padding: 18, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  gesture: { fontFamily: fonts.bold, fontSize: 24, color: colors.text },
  preview: { width: '100%', aspectRatio: 3 / 4, borderRadius: 16 },
});
