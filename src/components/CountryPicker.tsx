import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { COUNTRIES, countryName, flagOf } from '@/constants/countries';
import { colors, radius, spacing } from '@/constants/theme';
import { BottomSheet } from './Overlay';
import { T, TextField } from './ui';

export function CountryField({ value, onChange, label = 'Country' }: { value: string | null; onChange: (c: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <T v="caption" color={colors.textSecondary}>{label}</T>
      <Pressable accessibilityRole="button" accessibilityLabel="Choose country" onPress={() => setOpen(true)}
        style={{ minHeight: 54, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 }}>
        <T style={{ fontSize: 20 }}>{flagOf(value)}</T>
        <T style={{ flex: 1 }} color={value ? colors.text : colors.textMuted}>{value ? countryName(value) : 'Select your country'}</T>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>
      <CountrySheet visible={open} onClose={() => setOpen(false)} selected={value ? [value] : []} onPick={(c) => { onChange(c); setOpen(false); }} />
    </View>
  );
}

export function CountrySheet({ visible, onClose, selected, onPick, title = 'Choose a country' }: {
  visible: boolean; onClose: () => void; selected: string[]; onPick: (code: string) => void; title?: string;
}) {
  const [q, setQ] = useState('');
  const list = useMemo(() => COUNTRIES.filter((c) => c.name.toLowerCase().includes(q.trim().toLowerCase())), [q]);
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <TextField icon="search" placeholder="Search" value={q} onChangeText={setQ} autoCorrect={false} />
      <FlatList data={list} keyExtractor={(c) => c.code} style={{ maxHeight: 380, marginTop: spacing.sm }} keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable accessibilityRole="button" onPress={() => onPick(item.code)}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 12, backgroundColor: pressed ? colors.elevated : 'transparent' })}>
            <T style={{ fontSize: 20 }}>{item.flag}</T>
            <T style={{ flex: 1 }}>{item.name}</T>
            {selected.includes(item.code) && <Ionicons name="checkmark-circle" size={20} color={colors.violet} />}
          </Pressable>
        )} />
    </BottomSheet>
  );
}
