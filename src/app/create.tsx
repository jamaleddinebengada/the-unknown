import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '@/constants/theme';
import { t, type TKey } from '@/i18n';
import { haptic } from '@/utils/format';

const ITEMS: { key: TKey; icon: keyof typeof Ionicons.glyphMap; color: string; to: string }[] = [
  { key: 'create.free', icon: 'flash', color: colors.primary, to: '/free' },
  { key: 'create.activity', icon: 'calendar', color: '#E7ECFF', to: '/activity/new' },
  { key: 'create.group', icon: 'people', color: '#EEE8FF', to: '/activity/new?group=1' },
  { key: 'create.moment', icon: 'camera', color: '#FFE4E5', to: '/moment-new' },
];

/** Animated action menu behind the centre tab button. */
export default function Create() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View entering={FadeIn.duration(160)} style={s.backdrop}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => router.back()} accessibilityLabel={t('common.cancel')} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 18 }]}>
        <Text style={s.title}>{t('create.title')}</Text>
        {ITEMS.map((it, i) => (
          <Animated.View key={it.key} entering={FadeInDown.delay(40 + i * 50).springify().damping(16)}>
            <Pressable onPress={() => { haptic.tap(); router.back(); setTimeout(() => router.push(it.to as never), 60); }} style={({ pressed }) => [s.item, pressed && { backgroundColor: colors.bg }]} accessibilityRole="button">
              <View style={[s.icon, { backgroundColor: it.color }]}><Ionicons name={it.icon} size={22} color={colors.text} /></View>
              <Text style={s.label}>{t(it.key)}</Text>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          </Animated.View>
        ))}
        <Pressable onPress={() => router.back()} style={s.close} accessibilityRole="button" accessibilityLabel={t('common.cancel')}><Ionicons name="close" size={26} color={colors.text} /></Pressable>
      </View>
    </Animated.View>
  );
}
const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, gap: 6 },
  title: { fontFamily: fonts.extrabold, fontSize: 22, color: colors.text, marginBottom: 6 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, paddingHorizontal: 6, borderRadius: 16 },
  icon: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  label: { flex: 1, fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  close: { alignSelf: 'center', width: 52, height: 52, borderRadius: 26, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
});
