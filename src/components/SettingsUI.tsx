import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Switch, View } from 'react-native';
import { T } from '@/components/ui';
import { colors, fonts, radius } from '@/constants/theme';
import { haptic } from '@/utils/format';

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      {title && <T v="overline" color={colors.textMuted}>{title}</T>}
      <View style={s.group}>{children}</View>
    </View>
  );
}

export function Row({ icon, label, sub, value, onPress, danger, right, last }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; sub?: string; value?: string; onPress?: () => void; danger?: boolean; right?: ReactNode; last?: boolean;
}) {
  return (
    <Pressable accessibilityRole={onPress ? 'button' : undefined} onPress={onPress ? () => { haptic.tap(); onPress(); } : undefined} disabled={!onPress && !right}
      style={({ pressed }) => [s.row, !last && s.sep, pressed && onPress && { backgroundColor: colors.blush }]}>
      <View style={[s.icon, danger && { backgroundColor: 'rgba(224,70,110,0.1)' }]}>
        <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.violet} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <T style={{ fontFamily: fonts.semibold }} color={danger ? colors.danger : colors.text}>{label}</T>
        {sub && <T v="caption" color={colors.textMuted}>{sub}</T>}
      </View>
      {value && <T v="caption" color={colors.textMuted}>{value}</T>}
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={17} color={colors.textMuted} /> : null)}
    </Pressable>
  );
}

export const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => (
  <Switch accessibilityLabel={label} value={value} onValueChange={(v) => { haptic.tap(); onChange(v); }}
    trackColor={{ true: colors.primaryDeep, false: '#E4E1D6' }} thumbColor={colors.white} ios_backgroundColor="#E4E1D6" />
);

/** Single-choice list inside a group. */
export function Choice<V extends string>({ options, value, onChange }: { options: { value: V; label: string; sub?: string; locked?: boolean }[]; value: V; onChange: (v: V) => void }) {
  return (
    <View>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <Pressable key={o.value} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => { haptic.tap(); onChange(o.value); }}
            style={[s.row, i < options.length - 1 && s.sep]}>
            <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={22} color={on ? colors.violet : colors.textMuted} />
            <View style={{ flex: 1, gap: 1 }}>
              <T style={{ fontFamily: fonts.semibold }}>{o.label}</T>
              {o.sub && <T v="caption" color={colors.textMuted}>{o.sub}</T>}
            </View>
            {o.locked && <Ionicons name="lock-closed" size={15} color={colors.gold} />}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  group: { borderRadius: radius.xl, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder, overflow: 'hidden', shadowColor: '#172339', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 58 },
  sep: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.hairlineStrong },
  icon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blush },
});
