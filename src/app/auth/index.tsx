import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { PortalMark } from '@/components/Logo';
import { BackendNotice, Screen, StackHeader } from '@/components/Screen';
import { GradientButton, T } from '@/components/ui';
import { colors, radius, spacing } from '@/constants/theme';
import { friendlyError, isSupabaseConfigured } from '@/lib/supabase';
import { appleAvailable, signInWithApple } from '@/services/auth';

export default function CreateAccount() {
  const router = useRouter();
  const toast = useToast();
  const [apple, setApple] = useState(false);
  useEffect(() => { appleAvailable().then(setApple).catch(() => {}); }, []);

  const run = async (fn: () => Promise<void>) => {
    if (!isSupabaseConfigured) return toast(friendlyError(null), 'error');
    try { await fn(); } catch (e) {
      const code = (e as { code?: string }).code;
      if (code !== 'ERR_REQUEST_CANCELED') toast(friendlyError(e), 'error');
    }
  };

  return (
    <Screen atmosphere edges={['top', 'bottom']}>
      <StackHeader />
      <BackendNotice />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.xl }}>
        <PortalMark size={96} />
        <T v="screenTitle" style={{ textAlign: 'center', marginTop: spacing.md }}>Step into the unknown</T>
        <T color={colors.textSecondary} style={{ textAlign: 'center' }}>
          Your account stays private. Others only ever see your mystery profile until you choose to reveal more.
        </T>
      </View>
      <View style={{ paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm }}>
        {apple && Platform.OS === 'ios' && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={radius.pill} style={{ height: 54 }}
            onPress={() => run(signInWithApple)} />
        )}
        <GradientButton label="Continue with Email" icon="mail-outline" onPress={() => router.push({ pathname: '/auth/email', params: { mode: 'signup' } })} />
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: spacing.sm }}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.textMuted} />
          <T v="caption" color={colors.textMuted}>18+ only. By continuing you accept the Community Guidelines.</T>
        </View>
      </View>
    </Screen>
  );
}
