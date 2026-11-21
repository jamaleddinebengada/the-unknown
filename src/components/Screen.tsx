import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Atmosphere } from './Atmosphere';
import { IconButton, T } from './ui';

export function Screen({ children, style, atmosphere = false, edges = ['top'] }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; atmosphere?: boolean; edges?: ('top' | 'bottom')[];
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[{ flex: 1, backgroundColor: colors.bg, paddingTop: edges.includes('top') ? insets.top : 0, paddingBottom: edges.includes('bottom') ? insets.bottom : 0 }, style]}>
      {atmosphere && <Atmosphere stars={24} intensity={0.6} />}
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

/** Shown when the app runs without Supabase credentials, so nothing pretends to work. */
export function BackendNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <View style={styles.notice}>
      <Ionicons name="construct-outline" size={16} color={colors.warning} />
      <T v="caption" color={colors.warning} style={{ flex: 1 }}>
        Preview mode — backend not connected. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env.
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'center', margin: spacing.md, padding: spacing.sm, borderRadius: 12, backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1, borderColor: 'rgba(251,191,36,0.25)' },
});
