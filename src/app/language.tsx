import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { haptic } from '@/utils/format';
import { LANGS, needsRestartFor, setLanguage, t, useLanguage, type Lang } from '@/i18n';

/** English, French, Arabic (right-to-left) and Spanish. */
export default function Language() {
  const lang = useLanguage();
  const toast = useToast();
  const pick = async (l: Lang) => {
    haptic.tap();
    const restart = needsRestartFor(l);
    await setLanguage(l);
    if (restart) toast(t('language.restart'));
  };
  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title={t('language.title')} />
      <View style={{ padding: spacing.lg, gap: 10 }}>
        {LANGS.map((l) => (
          <Pressable key={l.code} onPress={() => pick(l.code)} style={[s.row, lang === l.code && s.on]} accessibilityRole="radio" accessibilityState={{ checked: lang === l.code }}>
            <View style={{ flex: 1 }}>
              <Text style={s.native}>{l.native}</Text>
              <T v="caption" color={colors.textMuted}>{l.label}</T>
            </View>
            {lang === l.code && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
          </Pressable>
        ))}
        <T v="caption" color={colors.textMuted} style={{ marginTop: 6 }}>{t('language.partial')}</T>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  on: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  native: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
});
