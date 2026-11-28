import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { AuthFrame, EMAIL_RE, GoogleButton, OrLine } from '@/components/AuthForm';
import { useToast } from '@/components/Overlay';
import { GradientButton, TextField } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { google, signUp } from '@/lib/authFlows';
import { friendlyError } from '@/lib/supabase';

export default function SignUp() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const go = async () => {
    setBusy('email');
    try { const r = await signUp(email, pw); if (r.needsConfirmation) setSent(email.trim()); }
    catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };
  return (
    <AuthFrame title={t('auth.signUp')} subtitle={t('app.slogan')}>
      {sent ? (
        <View style={{ gap: 14 }}>
          <Text style={{ fontFamily: fonts.medium, fontSize: 16, color: colors.text, lineHeight: 24 }}>📩 {t('auth.checkInbox', { email: sent })}</Text>
          <GradientButton label={t('auth.signIn')} onPress={() => router.replace('/auth/sign-in')} />
        </View>
      ) : (
        <>
          <GoogleButton busy={busy === 'g'} onPress={async () => { setBusy('g'); try { await google(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); } }} />
          <OrLine />
          <TextField value={email} onChangeText={setEmail} placeholder={t('auth.email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" icon="mail-outline" accessibilityLabel="Email" />
          <TextField value={pw} onChangeText={setPw} placeholder={t('auth.password')} secureTextEntry autoComplete="new-password" icon="lock-closed-outline" accessibilityLabel="Password" />
          <GradientButton label={t('auth.signUp')} loading={busy === 'email'} disabled={!EMAIL_RE.test(email.trim()) || pw.length < 8} onPress={go} />
          <Pressable onPress={() => router.replace('/auth/sign-in')} style={{ alignSelf: 'center', padding: 8 }}><Text style={{ fontFamily: fonts.semibold, color: colors.text }}>{t('auth.haveAccount')}</Text></Pressable>
          <Text style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>{t('intro.adults')}</Text>
        </>
      )}
    </AuthFrame>
  );
}
