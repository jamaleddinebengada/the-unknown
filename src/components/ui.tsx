import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View,
  type PressableProps, type StyleProp, type TextInputInstance, type TextInputProps, type TextProps, type TextStyle, type ViewStyle,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, FadeIn } from 'react-native-reanimated';
import { colors, fonts, glow, gradients, radius, spacing, type } from '@/constants/theme';
import { haptic } from '@/utils/format';
import { GlassCard, GlowRing, Shimmer } from './Effects';

/* ---------------- Typography ---------------- */
type Variant = keyof typeof type;
export function T({ v = 'body', color = colors.text, style, ...rest }: TextProps & { v?: Variant; color?: string }) {
  return <Text {...rest} style={[type[v] as TextStyle, { color }, style]} />;
}

/* ---------------- Press scale wrapper ---------------- */
const APressable = Animated.createAnimatedComponent(Pressable);
export function Pressy({ style, onPressIn, onPressOut, scaleTo = 0.97, ...rest }: PressableProps & { style?: StyleProp<ViewStyle>; scaleTo?: number }) {
  const s = useSharedValue(1);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <APressable
      {...rest}
      onPressIn={(e) => { s.set(withSpring(scaleTo, { damping: 18, stiffness: 400 })); onPressIn?.(e); }}
      onPressOut={(e) => { s.set(withSpring(1, { damping: 14, stiffness: 300 })); onPressOut?.(e); }}
      style={[style, a]}
    />
  );
}

/* ---------------- Buttons ---------------- */
interface BtnProps { label: string; onPress?: () => void; loading?: boolean; disabled?: boolean; icon?: keyof typeof Ionicons.glyphMap; style?: StyleProp<ViewStyle>; small?: boolean }

/** Glossy 3D "game" button: gradient face over a darker base that it sinks into when pressed. */
export function GradientButton({ label, onPress, loading, disabled, icon, style, small, colors: g = gradients.pill }: BtnProps & { colors?: readonly [string, string, ...string[]] }) {
  const off = disabled || loading;
  const press = useSharedValue(0);
  const face = useAnimatedStyle(() => ({ transform: [{ translateY: press.value * 3 }] }));
  const h = small ? 44 : 56;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={off}
      onPressIn={() => { press.set(withSpring(1, { damping: 20, stiffness: 500 })); }}
      onPressOut={() => { press.set(withSpring(0, { damping: 12, stiffness: 300 })); }}
      onPress={() => { haptic.soft(); onPress?.(); }}
      style={[{ opacity: off ? 0.55 : 1, paddingBottom: 4 }, style]}>
      <View style={[s.btnBase, { height: h, top: 4, backgroundColor: '#4A3BD6' }, !off && glow('#8B7BFF')]} />
      <Animated.View style={[{ height: h, borderRadius: radius.pill, overflow: 'hidden' }, face]}>
        <LinearGradient colors={g} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={[s.btn, small && s.btnSmall, { height: h }]}>
          <View pointerEvents="none" style={[s.btnGloss, { height: h * 0.48 }]} />
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.btnRim]} />
          {loading ? <ActivityIndicator color={colors.white} /> : (
            <>
              {icon && <Ionicons name={icon} size={small ? 17 : 20} color={colors.white} />}
              <Text style={[s.btnGame, small && { fontSize: 15 }]}>{label.toUpperCase()}</Text>
            </>
          )}
        </LinearGradient>
      </Animated.View>
    </Pressable>
  );
}

export function PremiumButton({ label, onPress, loading, disabled, icon, style, small, tone = 'default' }: BtnProps & { tone?: 'default' | 'ghost' | 'danger' }) {
  const off = disabled || loading;
  const fg = tone === 'danger' ? colors.danger : colors.text;
  return (
    <Pressy accessibilityRole="button" accessibilityLabel={label} disabled={off}
      onPress={() => { haptic.tap(); onPress?.(); }}
      style={[s.btn, small && s.btnSmall, tone === 'ghost' ? s.ghost : s.solid, { opacity: off ? 0.5 : 1 }, style]}>
      {loading ? <ActivityIndicator color={fg} /> : (
        <>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={fg} />}
          <Text style={[s.btnLabel, { color: fg }, small && { fontSize: 14 }]}>{label}</Text>
        </>
      )}
    </Pressy>
  );
}

export function IconButton({ name, onPress, size = 22, color = colors.text, badge, label, style }: {
  name: keyof typeof Ionicons.glyphMap; onPress?: () => void; size?: number; color?: string; badge?: number; label: string; style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pressy accessibilityRole="button" accessibilityLabel={label} hitSlop={8} scaleTo={0.9}
      onPress={() => { haptic.tap(); onPress?.(); }} style={[s.iconBtn, style]}>
      <Ionicons name={name} size={size} color={color} />
      {!!badge && <NotificationBadge count={badge} style={{ position: 'absolute', top: 4, right: 4 }} />}
    </Pressy>
  );
}

/* ---------------- Chips & tags ---------------- */
export function CategoryChip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <Pressy accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { haptic.tap(); onPress?.(); }}
      style={[s.chip, selected && s.chipOn]}>
      {selected && <LinearGradient colors={['#7C6CFF', '#A855F7', '#60A5FA']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: radius.pill }]} />}
      {icon && <Ionicons name={icon} size={14} color={selected ? colors.white : colors.textSecondary} />}
      <Text style={[s.chipLabel, selected && { color: colors.white, fontFamily: fonts.semibold }]}>{label}</Text>
    </Pressy>
  );
}

export function InterestTag({ label, accent = false }: { label: string; accent?: boolean }) {
  return (
    <View style={[s.tag, accent && { backgroundColor: colors.violetTint, borderColor: 'rgba(139,92,246,0.35)' }]}>
      <Text style={[s.tagLabel, accent && { color: colors.violetSoft }]}>{label}</Text>
    </View>
  );
}

export function PremiumBadge({ label = 'PLUS' }: { label?: string }) {
  return (
    <LinearGradient colors={gradients.secondary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.premium}>
      <Ionicons name="sparkles" size={10} color={colors.white} />
      <Text style={s.premiumLabel}>{label}</Text>
    </LinearGradient>
  );
}

export function NotificationBadge({ count, style }: { count: number; style?: StyleProp<ViewStyle> }) {
  if (count <= 0) return null;
  return (
    <View style={[s.badge, style]}>
      <Text style={s.badgeLabel}>{count > 99 ? '99+' : count}</Text>
    </View>
  );
}

/* ---------------- Surfaces ---------------- */
export function Card({ children, style, glowing }: { children: ReactNode; style?: StyleProp<ViewStyle>; glowing?: boolean }) {
  return (
    <View style={[s.card, glowing && { borderColor: 'rgba(139,92,246,0.35)' }, style]}>
      {glowing && <LinearGradient pointerEvents="none" colors={gradients.cardSheen} style={StyleSheet.absoluteFill} />}
      {children}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.hairlineStrong }, style]} />;
}

/* ---------------- Inputs ---------------- */
export const TextField = forwardRef<TextInputInstance, TextInputProps & { label?: string; icon?: keyof typeof Ionicons.glyphMap; error?: string; right?: ReactNode }>(
  function TextField({ label, icon, error, style, right, ...rest }, ref) {
    const [focus, setFocus] = useState(false);
    return (
      <View style={{ gap: 8 }}>
        {label && <T v="caption" color={colors.textSecondary}>{label}</T>}
        <View style={[s.field, focus && { borderColor: colors.violet }, !!error && { borderColor: colors.danger }]}>
          {icon && <Ionicons name={icon} size={18} color={focus ? colors.violetSoft : colors.textMuted} />}
          <TextInput ref={ref} placeholderTextColor={colors.textMuted} selectionColor={colors.violet}
            onFocus={(e) => { setFocus(true); rest.onFocus?.(e); }} onBlur={(e) => { setFocus(false); rest.onBlur?.(e); }}
            style={[s.fieldInput, style]} {...rest} />
          {right}
        </View>
        {!!error && <T v="caption" color={colors.danger}>{error}</T>}
      </View>
    );
  },
);

/* ---------------- States ---------------- */
export function EmptyState({ icon = 'planet-outline', title, body, action, onAction }: {
  icon?: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: string; onAction?: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(400)} style={s.empty}>
      <GlowRing size={136}>
        <View style={s.emptyOrb}>
          <LinearGradient colors={['rgba(109,74,255,0.45)', 'rgba(56,189,248,0.06)']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: 60 }]} />
          <Ionicons name={icon} size={40} color={colors.violetSoft} />
        </View>
      </GlowRing>
      <T v="section" style={{ textAlign: 'center' }}>{title}</T>
      {body && <T color={colors.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>{body}</T>}
      {action && <GradientButton small label={action} onPress={onAction} style={{ marginTop: spacing.sm }} />}
    </Animated.View>
  );
}

export function Skeleton({ w = '100%', h = 14, r = 8, style }: { w?: number | `${number}%`; h?: number; r?: number; style?: StyleProp<ViewStyle> }) {
  return <Shimmer style={[{ width: w, height: h, borderRadius: r }, style]} />;
}

export function PostSkeleton() {
  return (
    <GlassCard style={{ marginBottom: 2 }}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Skeleton w={44} h={44} r={22} />
          <View style={{ gap: 6, flex: 1 }}><Skeleton w="45%" h={12} /><Skeleton w="25%" h={10} /></View>
        </View>
        <Skeleton h={14} /><Skeleton w="82%" h={14} /><Skeleton w="55%" h={14} />
        <View style={{ flexDirection: 'row', gap: 10 }}><Skeleton w={60} h={28} r={14} /><Skeleton w={60} h={28} r={14} /><View style={{ flex: 1 }} /><Skeleton w={120} h={34} r={17} /></View>
      </View>
    </GlassCard>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <EmptyState icon="cloud-offline-outline" title="Something drifted away" body={message} action={onRetry ? 'Try again' : undefined} onAction={onRetry} />;
}

export type IconName = ComponentProps<typeof Ionicons>['name'];

const s = StyleSheet.create({
  btn: { height: 54, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: spacing.xl },
  btnSmall: { height: 42, paddingHorizontal: spacing.lg },
  btnLabel: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text, letterSpacing: 0.2 },
  btnGame: { fontFamily: fonts.display, fontSize: 18, color: colors.white, letterSpacing: 0.6, textShadowColor: 'rgba(30,20,90,0.6)', textShadowOffset: { width: 0, height: 1.5 }, textShadowRadius: 2 },
  btnBase: { position: 'absolute', left: 0, right: 0, borderRadius: radius.pill },
  btnGloss: { position: 'absolute', top: 0, left: 0, right: 0, borderTopLeftRadius: radius.pill, borderTopRightRadius: radius.pill, backgroundColor: 'rgba(255,255,255,0.16)' },
  btnRim: { borderRadius: radius.pill, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)' },
  solid: { backgroundColor: colors.elevated },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.hairlineStrong },
  iconBtn: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#4C3FB8', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 16, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.surfaceBorder },
  chipOn: { borderColor: 'rgba(124,108,255,0.6)', overflow: 'hidden' },
  chipLabel: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary },
  tag: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.elevated, borderWidth: 1, borderColor: colors.surfaceBorder },
  tagLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  premium: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill },
  premiumLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.white, letterSpacing: 1 },
  badge: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
  badgeLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.hairline, overflow: 'hidden' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, paddingHorizontal: 16, borderRadius: radius.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  fieldInput: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: spacing.xl },
  emptyOrb: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
