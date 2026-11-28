import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { GradientButton, TextField } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { completeRedirect, setPassword } from '@/lib/authFlows';
import { friendlyError } from '@/lib/supabase';

/** Target of email confirmation, password reset and Google links. */
export default function AuthCallback() {
  const url = Linking.useLinkingURL();
  const router = useRouter();
  const toast = useToast();
  const [state, setState] = useState<'working' | 'recovery' | 'failed'>('working');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const done = useRef(false);
  useEffect(() => {
    if (!url || done.current || !url.includes('auth-callback')) return;
    done.current = true;
    completeRedirect(url).then((r) => {
      if (!r.ok) setState('failed');
      else if (r.type === 'recovery') setState('recovery');
      else router.replace('/');
    });
  }, [url, router]);
  return (
    <View style={s.wrap}>
      {state === 'working' && <ActivityIndicator color={colors.text} size="large" />}
      {state === 'failed' && <><Text style={s.h}>⚠️</Text><GradientButton label={t('common.continue')} onPress={() => router.replace('/')} style={{ alignSelf: 'stretch' }} /></>}
      {state === 'recovery' && (
        <View style={{ alignSelf: 'stretch', gap: 14 }}>
          <Text style={s.h}>{t('auth.newPassword')}</Text>
          <TextField value={pw} onChangeText={setPw} secureTextEntry placeholder={t('auth.password')} />
          <GradientButton label={t('common.save')} loading={busy} disabled={pw.length < 8}
            onPress={async () => { setBusy(true); try { await setPassword(pw); toast(t('auth.passwordSaved'), 'success'); router.replace('/'); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); } }} />
        </View>
      )}
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: colors.white },
  h: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.text, textAlign: 'center' },
});
