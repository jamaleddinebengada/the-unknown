import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useToast } from '@/components/Overlay';
import { BackendNotice, Screen, StackHeader } from '@/components/Screen';
import { GradientButton, T, TextField } from '@/components/ui';
import { colors, spacing } from '@/constants/theme';
import { friendlyError, isSupabaseConfigured } from '@/lib/supabase';
import { sendPasswordReset, signInWithEmail, signUpWithEmail } from '@/services/auth';

const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export default function EmailAuth() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'signin' | 'signup'>(params.mode === 'signin' ? 'signin' : 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const toast = useToast();
  const router = useRouter();

  const pwError = mode === 'signup' && password.length > 0 && password.length < 8 ? 'Use at least 8 characters.' : undefined;
  const canSubmit = emailOk(email) && password.length >= (mode === 'signup' ? 8 : 1);

  const submit = async () => {
    if (!isSupabaseConfigured) return toast(friendlyError(null), 'error');
    setBusy(true);
    try {
      if (mode === 'signup') {
        const { needsConfirmation } = await signUpWithEmail(email.trim(), password);
        if (needsConfirmation) setSent(true);
      } else {
        await signInWithEmail(email.trim(), password);
      }
      // AuthProvider picks up the session; the splash route decides where to go.
      if (mode === 'signin') router.replace('/');
    } catch (e) { toast(friendlyError(e), 'error'); } finally { setBusy(false); }
  };

  const reset = async () => {
    if (!emailOk(email)) return toast('Enter your email first.', 'error');
    try { await sendPasswordReset(email.trim()); toast('Check your inbox for a reset link.', 'success'); } catch (e) { toast(friendlyError(e), 'error'); }
  };

  if (sent) {
    return (
      <Screen atmosphere edges={['top', 'bottom']}>
        <StackHeader />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
          <Ionicons name="mail-unread-outline" size={56} color={colors.violetSoft} />
          <T v="screenTitle" style={{ textAlign: 'center' }}>Check your inbox</T>
          <T color={colors.textSecondary} style={{ textAlign: 'center' }}>We sent a confirmation link to {email.trim()}. Open it on this device to continue.</T>
          <GradientButton label="I confirmed — sign in" onPress={() => { setSent(false); setMode('signin'); }} style={{ alignSelf: 'stretch', marginTop: spacing.lg }} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen atmosphere edges={['top', 'bottom']}>
      <StackHeader />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg, flexGrow: 1 }} keyboardShouldPersistTaps="handled">
          <BackendNotice />
          <Animated.View entering={FadeInDown.springify().damping(18)} style={{ gap: 6 }}>
            <T v="screenTitle">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</T>
            <T color={colors.textSecondary}>{mode === 'signup' ? 'Only you see your email. Never shown to anyone.' : 'The unknown missed you.'}</T>
          </Animated.View>
          <TextField label="Email" icon="mail-outline" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" textContentType="emailAddress" placeholder="you@example.com" />
          <TextField label="Password" icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry={!show}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} placeholder="••••••••" error={pwError}
            right={<Pressable accessibilityLabel={show ? 'Hide password' : 'Show password'} onPress={() => setShow(!show)} hitSlop={10}>
              <Ionicons name={show ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.textMuted} /></Pressable>} />
          {mode === 'signin' && (
            <Pressable onPress={reset} accessibilityRole="button"><T v="caption" color={colors.violetSoft}>Forgot password?</T></Pressable>
          )}
          <View style={{ flex: 1 }} />
          <GradientButton label={mode === 'signup' ? 'Create account' : 'Sign in'} disabled={!canSubmit} loading={busy} onPress={submit} />
          <Pressable accessibilityRole="button" onPress={() => setMode(mode === 'signup' ? 'signin' : 'signup')} style={{ alignSelf: 'center', padding: 8 }}>
            <T v="caption" color={colors.textSecondary}>
              {mode === 'signup' ? 'Already have an account? ' : 'New here? '}
              <T v="caption" color={colors.violetSoft}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</T>
            </T>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
