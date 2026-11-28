import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { CITIES } from '@/constants/cities';
import { flagOf } from '@/constants/countries';
import { colors, fonts } from '@/constants/theme';
import { t } from '@/i18n';
import { BottomSheet } from './Overlay';

export function CitySheet({ visible, onClose, onPick }: { visible: boolean; onClose: () => void; onPick: (c: (typeof CITIES)[number]) => void }) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t('setup.chooseCity')}>
      <ScrollView style={{ maxHeight: 460 }}>
        {CITIES.map((c) => (
          <Pressable key={`${c.name}-${c.country}`} onPress={() => { onClose(); onPick(c); }} style={({ pressed }) => [s.row, pressed && { backgroundColor: colors.bg }]} accessibilityRole="button">
            <Text style={{ fontSize: 18 }}>{flagOf(c.country)}</Text><Text style={s.name}>{c.name}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, paddingHorizontal: 6, borderRadius: 12 },
  name: { fontFamily: fonts.semibold, fontSize: 15.5, color: colors.text },
});
