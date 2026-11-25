import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { Screen } from '@/components/Screen';
import { GradientButton, T, TextField } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { completeAuthRedirect, setPassword } from '@/features/auth/account';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/lib/supabase';
import { t } from '@/i18n';

/** Target of e-mail confirmation, password-reset and Google links (theunknown://auth-callback?code=…). */
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const router = useRouter();
  const toast = useToast();
  const { entered, enter, refreshProfile } = useAuth();
  const [state, setState] = useState<'working' | 'recovery' | 'failed'>('working');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const handled = useRef(false);

  const finish = async () => {
    const p = await refreshProfile();
    if (!entered && p?.birth_date) await enter();
    router.replace(entered || p?.birth_date ? '/nearby' : '/setup');
  };

  useEffect(() => {
    if (!url || handled.current || !url.includes('auth-callback')) return;
    handled.current = true;
    completeAuthRedirect(url).then(async (r) => {
      if (!r.ok) { setState('failed'); return; }
      if (r.type === 'recovery') { setState('recovery'); return; }
      toast(t('account.callbackDone'), 'success');
      await finish();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={s.wrap}>
        {state === 'working' && (<><ActivityIndicator color={colors.primary} size="large" /><T color={colors.textMuted}>{t('account.callbackWorking')}</T></>)}
        {state === 'failed' && (<>
          <Text style={s.h}>{t('account.callbackFailed')}</Text>
          <GradientButton label={t('common.continue')} onPress={() => router.replace('/')} style={{ alignSelf: 'stretch' }} />
        </>)}
        {state === 'recovery' && (<>
          <Text style={s.h}>{t('account.setNewPassword')}</Text>
          <View style={{ alignSelf: 'stretch' }}>
            <TextField value={pw} onChangeText={setPw} secureTextEntry placeholder={t('account.newPassword')} autoComplete="new-password" />
          </View>
          <GradientButton label={t('account.savePassword')} loading={busy} disabled={pw.length < 8} style={{ alignSelf: 'stretch' }}
            onPress={async () => { setBusy(true); try { await setPassword(pw); toast(t('account.passwordSaved'), 'success'); await finish(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); } }} />
        </>)}
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  h: { fontFamily: fonts.bold, fontSize: 20, color: colors.text, textAlign: 'center' },
});
