import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { IconButton } from './ui';

/** Shared frame for sign-in / sign-up / reset. */
export function AuthFrame({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: insets.bottom + 32, gap: 16 }} keyboardShouldPersistTaps="handled">
        <IconButton name="chevron-back" label={t('common.back')} onPress={() => (router.canGoBack() ? router.back() : router.replace('/intro'))} />
        <View style={s.logo}><Text style={{ fontSize: 30 }}>⚡</Text></View>
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.sub}>{subtitle}</Text>}
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
export function GoogleButton({ onPress, busy }: { onPress: () => void; busy?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy} style={({ pressed }) => [s.google, pressed && { opacity: 0.8 }]} accessibilityRole="button">
      <Text style={s.g}>G</Text><Text style={s.gText}>{busy ? '…' : t('auth.google')}</Text>
    </Pressable>
  );
}
export function OrLine() {
  return <View style={s.or}><View style={s.line} /><Text style={s.orText}>{t('common.or')}</Text><View style={s.line} /></View>;
}
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const s = StyleSheet.create({
  logo: { width: 60, height: 60, borderRadius: 18, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  title: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text, letterSpacing: -0.6 },
  sub: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted, lineHeight: 22 },
  google: { height: 54, borderRadius: 27, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.white },
  g: { fontFamily: fonts.extrabold, fontSize: 19, color: '#4285F4' },
  gText: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.text },
  or: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  orText: { fontFamily: fonts.medium, fontSize: 13, color: colors.textMuted },
});
