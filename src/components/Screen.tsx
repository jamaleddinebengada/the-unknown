import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { Aurora } from './Effects';
import { IconButton, T } from './ui';

export function Screen({ children, style, atmosphere = true, edges = ['top'] }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; atmosphere?: boolean; edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: edges.includes('bottom') ? insets.bottom : 0 }, style]}>
      {atmosphere && <Aurora stars={14} />}
      {children}
    </View>
  );
}

/** Header for pushed screens: back button, centered title, optional right slot. */
export function StackHeader({ title, right, onBack }: { title?: string; right?: ReactNode; onBack?: () => void }) {
  const router = useRouter();
  return (
    <View style={styles.header}>
      <IconButton label="Back" name="chevron-back" onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/discover')))} />
      <T v="cardTitle" numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>{title}</T>
      <View style={{ minWidth: 42, alignItems: 'flex-end' }}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
});
