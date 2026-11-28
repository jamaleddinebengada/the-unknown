import { useState } from 'react';
import { Text } from 'react-native';
import { AuthFrame, EMAIL_RE } from '@/components/AuthForm';
import { useToast } from '@/components/Overlay';
import { GradientButton, TextField } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { resetPassword } from '@/lib/authFlows';
import { friendlyError } from '@/lib/supabase';

export default function Reset() {
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  return (
    <AuthFrame title={t('auth.reset')} subtitle={t('auth.resetBody')}>
      <TextField value={email} onChangeText={setEmail} placeholder={t('auth.email')} keyboardType="email-address" autoCapitalize="none" icon="mail-outline" accessibilityLabel="Email" />
      {sent && <Text style={{ fontFamily: fonts.medium, color: colors.text }}>📩 {t('auth.resetSent', { email: sent })}</Text>}
      <GradientButton label={t('auth.resetSend')} loading={busy} disabled={!EMAIL_RE.test(email.trim())}
        onPress={async () => { setBusy(true); try { await resetPassword(email); setSent(email.trim()); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); } }} />
    </AuthFrame>
  );
}
