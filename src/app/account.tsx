import { Ionicons } from '@expo/vector-icons';
import type { User } from '@supabase/supabase-js';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { GradientButton, PremiumButton, T, TextField } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { continueWithGoogle, currentUser, secureWithEmail, sendPasswordReset, setPassword, signInWithEmail, signOutToGuest } from '@/features/auth/account';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError, supabase } from '@/lib/supabase';
import { t } from '@/i18n';

type Mode = 'overview' | 'signin' | 'forgot';
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Account & sign-in: secure the guest identity (email / Google), sign in on another phone, reset a password. */
export default function Account() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ mode?: Mode }>();
  const { entered, enter, refreshProfile } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [mode, setMode] = useState<Mode>(params.mode ?? 'overview');
  const [email, setEmail] = useState('');
  const [password, setPw] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  const load = useCallback(async () => setUser(await currentUser()), []);
  useEffect(() => {
    load();
    const { data } = supabase.auth.onAuthStateChange(() => { load(); });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const isGuest = !user || user.is_anonymous === true;
  const pendingEmail = user?.new_email ?? null;
  const hasGoogle = !!user?.identities?.some((i) => i.provider === 'google');

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(null); }
  };

  /** After signing in to an existing account: skip onboarding if it was already done. */
  const afterSignIn = async () => {
    const p = await refreshProfile();
    if (!entered && p?.birth_date) { await enter(); router.replace('/nearby'); return; }
    if (!entered) { router.replace('/setup'); return; }
    router.back();
  };

  const google = () => run('google', async () => {
    const ok = await continueWithGoogle(isGuest && mode === 'overview');
    if (!ok) return;
    toast(t('account.googleDone'), 'success');
    await load();
    if (mode === 'signin') await afterSignIn();
  });

  const signOut = () => Alert.alert(t('account.signOutTitle'), t('account.signOutBody'), [
    { text: t('common.cancel'), style: 'cancel' },
    { text: t('account.signOut'), style: 'destructive', onPress: () => run('out', async () => { await signOutToGuest(); router.replace('/'); }) },
  ]);

  return (
    <Screen edges={['top']}>
      <StackHeader title={mode === 'signin' ? t('account.signIn') : mode === 'forgot' ? t('account.resetTitle') : t('account.title')}
        onBack={mode !== 'overview' && params.mode !== mode ? () => setMode('overview') : undefined} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
          {mode === 'overview' && (
            <>
              <View style={s.status}>
                <View style={[s.statusIcon, { backgroundColor: isGuest ? '#FFF4D6' : '#DCFCE7' }]}>
                  <Ionicons name={isGuest ? 'person-outline' : 'shield-checkmark'} size={22} color={isGuest ? '#B7791F' : colors.online} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.h}>{isGuest ? t('account.guestTitle') : t('account.securedTitle')}</Text>
                  <T v="caption" color={colors.textMuted}>{isGuest ? t('account.guestBody') : user?.email ?? ''}{hasGoogle ? ' · Google' : ''}</T>
                </View>
              </View>

              {isGuest ? (
                <>
                  <Text style={s.section}>{t('account.secureTitle')}</Text>
                  {pendingEmail || sent ? (
                    <View style={s.note}><Ionicons name="mail-unread-outline" size={20} color={colors.primary} /><T style={{ flex: 1 }}>{t('account.checkInbox', { email: pendingEmail ?? sent ?? '' })}</T></View>
                  ) : null}
                  <TextField value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" icon="mail-outline" accessibilityLabel="Email" />
                  <GradientButton label={t('account.sendLink')} loading={busy === 'secure'} disabled={!EMAIL.test(email.trim())}
                    onPress={() => run('secure', async () => { await secureWithEmail(email); setSent(email.trim()); toast(t('account.linkSent'), 'success'); })} />
                  <GoogleButton onPress={google} loading={busy === 'google'} label={t('account.google')} />
                  <View style={s.divider}><View style={s.line} /><T v="caption" color={colors.textMuted}>{t('account.or')}</T><View style={s.line} /></View>
                  <PremiumButton label={t('account.haveAccount')} tone="ghost" onPress={() => setMode('signin')} />
                </>
              ) : (
                <>
                  <Text style={s.section}>{t('account.password')}</Text>
                  <TextField value={password} onChangeText={setPw} placeholder={t('account.newPassword')} secureTextEntry autoComplete="new-password" icon="lock-closed-outline" accessibilityLabel="New password" />
                  <GradientButton label={t('account.savePassword')} loading={busy === 'pw'} disabled={password.length < 8}
                    onPress={() => run('pw', async () => { await setPassword(password); setPw(''); toast(t('account.passwordSaved'), 'success'); })} />
                  {!hasGoogle && <GoogleButton onPress={google} loading={busy === 'google'} label={t('account.linkGoogle')} />}
                  <PremiumButton label={t('account.signOut')} tone="danger" loading={busy === 'out'} onPress={signOut} />
                </>
              )}
              <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>{t('account.adultsOnly')}</T>
            </>
          )}

          {mode === 'signin' && (
            <>
              <T color={colors.textMuted}>{t('account.signInBody')}</T>
              <TextField value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoComplete="email" icon="mail-outline" accessibilityLabel="Email" />
              <TextField value={password} onChangeText={setPw} placeholder={t('account.passwordPlaceholder')} secureTextEntry autoComplete="password" icon="lock-closed-outline" accessibilityLabel="Password" />
              <GradientButton label={t('account.signIn')} loading={busy === 'in'} disabled={!EMAIL.test(email.trim()) || password.length < 6}
                onPress={() => run('in', async () => { await signInWithEmail(email, password); setPw(''); await afterSignIn(); })} />
              <Pressable onPress={() => setMode('forgot')} style={{ alignSelf: 'center', padding: 8 }}><Text style={s.link}>{t('account.forgot')}</Text></Pressable>
              <View style={s.divider}><View style={s.line} /><T v="caption" color={colors.textMuted}>{t('account.or')}</T><View style={s.line} /></View>
              <GoogleButton onPress={google} loading={busy === 'google'} label={t('account.google')} />
            </>
          )}

          {mode === 'forgot' && (
            <>
              <T color={colors.textMuted}>{t('account.resetBody')}</T>
              <TextField value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" icon="mail-outline" accessibilityLabel="Email" />
              {sent && <View style={s.note}><Ionicons name="mail-unread-outline" size={20} color={colors.primary} /><T style={{ flex: 1 }}>{t('account.resetSent', { email: sent })}</T></View>}
              <GradientButton label={t('account.sendReset')} loading={busy === 'reset'} disabled={!EMAIL.test(email.trim())}
                onPress={() => run('reset', async () => { await sendPasswordReset(email); setSent(email.trim()); })} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function GoogleButton({ onPress, loading, label }: { onPress: () => void; loading?: boolean; label: string }) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [s.google, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <Text style={s.gLogo}>G</Text>
      <Text style={s.gText}>{loading ? '…' : label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 16, backgroundColor: colors.white, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  statusIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  h: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  section: { fontFamily: fonts.bold, fontSize: 15, color: colors.text, marginTop: 6 },
  note: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: colors.primarySoft },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 4 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  link: { fontFamily: fonts.semibold, color: colors.primary, fontSize: 14 },
  google: { height: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  gLogo: { fontFamily: fonts.bold, fontSize: 18, color: '#4285F4' },
  gText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
});
