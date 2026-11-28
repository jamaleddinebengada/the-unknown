import type { ErrorBoundaryProps } from 'expo-router';
import { View } from 'react-native';
import { colors, spacing } from '@/constants/theme';
import { GradientButton, T } from './ui';

/** Route-level error screen: a bug in one screen shows this instead of closing the app. */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md }}>
      <T v="section" style={{ textAlign: 'center' }}>Something drifted away</T>
      <T color={colors.textSecondary} style={{ textAlign: 'center' }}>This screen hit an unexpected problem. Try again.</T>
      <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }} numberOfLines={3}>{error?.message}</T>
      <GradientButton label="Try again" onPress={retry} style={{ alignSelf: 'stretch', marginTop: spacing.md }} />
    </View>
  );
}
