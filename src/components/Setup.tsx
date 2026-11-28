import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { IconButton } from './ui';

/** Frame for the 3 profile-setup steps: progress, title, scroll body, fixed footer. */
export function SetupFrame({ step, title, subtitle, children, footer, back = true }: { step: number; title: string; subtitle?: string; children: ReactNode; footer: ReactNode; back?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.white }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[s.top, { paddingTop: insets.top + 6 }]}>
        {back ? <IconButton name="chevron-back" label={t('common.back')} onPress={() => router.back()} /> : <View style={{ width: 42 }} />}
        <View style={s.bar}><View style={[s.fill, { width: `${(step / 3) * 100}%` }]} /></View>
        <Text style={s.step}>{t('setup.step', { n: step })}</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 22, gap: 18, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={s.title}>{title}</Text>
        {subtitle && <Text style={s.sub}>{subtitle}</Text>}
        {children}
      </ScrollView>
      <View style={[s.footer, { paddingBottom: insets.bottom + 12 }]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}
export function Label({ children, hint }: { children: ReactNode; hint?: string }) {
  return <View style={{ gap: 3 }}><Text style={s.label}>{children}</Text>{hint && <Text style={s.hint}>{hint}</Text>}</View>;
}
const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  bar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.bgSecondary, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.primary },
  step: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textMuted },
  title: { fontFamily: fonts.extrabold, fontSize: 28, color: colors.text, letterSpacing: -0.6 },
  sub: { fontFamily: fonts.medium, fontSize: 15, color: colors.textMuted, lineHeight: 22, marginTop: -8 },
  label: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 12.5, color: colors.textMuted },
  footer: { paddingHorizontal: 22, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.white },
});
