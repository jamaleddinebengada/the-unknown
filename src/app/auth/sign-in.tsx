import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text } from 'react-native';
import { AuthFrame, EMAIL_RE, GoogleButton, OrLine } from '@/components/AuthForm';
import { useToast } from '@/components/Overlay';
import { GradientButton, TextField } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { google, signIn } from '@/lib/authFlows';
import { friendlyError } from '@/lib/supabase';

export default function SignIn() {
  const router = useRouter();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  return (
    <AuthFrame title={t('auth.signIn')}>
      <GoogleButton busy={busy === 'g'} onPress={async () => { setBusy('g'); try { await google(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); } }} />
      <OrLine />
      <TextField value={email} onChangeText={setEmail} placeholder={t('auth.email')} keyboardType="email-address" autoCapitalize="none" autoComplete="email" icon="mail-outline" accessibilityLabel="Email" />
      <TextField value={pw} onChangeText={setPw} placeholder={t('auth.password')} secureTextEntry autoComplete="password" icon="lock-closed-outline" accessibilityLabel="Password" />
      <GradientButton label={t('auth.signIn')} loading={busy === 'e'} disabled={!EMAIL_RE.test(email.trim()) || pw.length < 6}
        onPress={async () => { setBusy('e'); try { await signIn(email, pw); router.replace('/'); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); } }} />
      <Pressable onPress={() => router.push('/auth/reset')} style={{ alignSelf: 'center', padding: 6 }}><Text style={{ fontFamily: fonts.semibold, color: colors.accent }}>{t('auth.forgot')}</Text></Pressable>
      <Pressable onPress={() => router.replace('/auth/sign-up')} style={{ alignSelf: 'center', padding: 6 }}><Text style={{ fontFamily: fonts.semibold, color: colors.text }}>{t('auth.noAccount')}</Text></Pressable>
    </AuthFrame>
  );
}
