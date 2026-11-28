import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useToast } from '@/components/Overlay';
import { Screen, StackHeader } from '@/components/Screen';
import { colors, fonts } from '@/constants/theme';
import { LANGS, needsRestartFor, setLanguage, t, useLanguage } from '@/i18n';

export default function Language() {
  const lang = useLanguage();
  const toast = useToast();
  return (
    <Screen>
      <StackHeader title={t('settings.language')} />
      <View style={{ padding: 20, gap: 10 }}>
        {LANGS.map((l) => (
          <Pressable key={l.code} onPress={async () => { const r = needsRestartFor(l.code); await setLanguage(l.code); if (r) toast(t('settings.restartRtl')); }}
            style={[s.row, lang === l.code && s.on]} accessibilityRole="radio" accessibilityState={{ checked: lang === l.code }}>
            <Text style={s.name}>{l.native}</Text>
            {lang === l.code && <Ionicons name="checkmark-circle" size={22} color={colors.text} />}
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  on: { backgroundColor: colors.primarySoft, borderColor: colors.primaryDeep },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
});
