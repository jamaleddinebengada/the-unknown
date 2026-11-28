import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { useAuth } from '@/lib/auth';

/** Entry: sends people to the intro, profile setup or Home. */
export default function Index() {
  const { session, boot, bootError, refresh, signOut } = useAuth();
  if (!session) return <Redirect href="/intro" />;
  if (boot) return <Redirect href={boot.profile.onboarded ? '/home' : '/setup/profile'} />;
  return (
    <View style={s.wrap}>
      {bootError ? (
        <>
          <Text style={s.h}>WhoIsFree</Text>
          <Text style={s.p}>{bootError.includes('function') || bootError.includes('does not exist') ? t('server.notReady') : bootError}</Text>
          <GradientButton label={t('common.retry')} onPress={() => refresh()} style={{ alignSelf: 'stretch' }} />
          <Text onPress={signOut} style={s.link}>{t('settings.signOut')}</Text>
        </>
      ) : <ActivityIndicator color={colors.text} />}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28, backgroundColor: colors.bg },
  h: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text },
  p: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted, textAlign: 'center' },
  link: { fontFamily: fonts.semibold, color: colors.accent, padding: 8 },
});
