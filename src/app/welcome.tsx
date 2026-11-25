import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaskLogo } from '@/components/Brand';
import { GradientButton, T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { haptic } from '@/utils/format';

const POINTS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  { icon: 'location', title: 'People nearby', body: 'Discover real people around you — only approximate distance is ever shown.' },
  { icon: 'heart', title: 'Match & chat', body: 'Like each other to match, or say hi and start a conversation.' },
  { icon: 'shield-checkmark', title: 'Private by design', body: 'Stay anonymous as long as you want. Reveal yourself only when you both agree.' },
];

function Ring({ size, delay }: { size: number; delay: number }) {
  const t = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => { if (!reduce) t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 3000, easing: Easing.out(Easing.quad) }), -1))); }, [t, delay, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: reduce ? 0.35 : 0.6 * (1 - t.value), transform: [{ scale: reduce ? 0.8 : 0.3 + t.value * 0.8 }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }, a]} />;
}

/** Welcome: what the app is, then a short profile setup (18+). */
export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const heroH = Math.min(height * (height < 700 ? 0.32 : 0.42), 380);
  const ring = Math.min(width * 0.9, heroH * 1.05, 340);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={['#3BA0FF', '#168AF7', '#0B6FD1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.hero, { height: heroH + insets.top, paddingTop: insets.top }]}>
        <View style={{ alignItems: 'center', justifyContent: 'center', width: ring, height: ring * 0.8 }}>
          {[0, 1, 2].map((i) => <Ring key={i} size={ring} delay={i * 1000} />)}
          <Animated.View entering={FadeInDown.springify().damping(14)} style={s.logo}><MaskLogo size={78} tone="white" /></Animated.View>
        </View>
        <Text style={s.brand}>THE UNKNOWN</Text>
      </LinearGradient>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.md, gap: spacing.md }} showsVerticalScrollIndicator={false}>
        <Animated.Text entering={FadeInDown.delay(100)} style={s.title}>Meet new people near you</Animated.Text>
        {POINTS.map((p, i) => (
          <Animated.View key={p.title} entering={FadeInDown.delay(180 + i * 90).duration(350)} style={s.point}>
            <View style={s.pointIcon}><Ionicons name={p.icon} size={18} color={colors.primary} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.pointTitle}>{p.title}</Text>
              <T v="caption" color={colors.textMuted}>{p.body}</T>
            </View>
          </Animated.View>
        ))}
      </ScrollView>
      <Animated.View entering={FadeInUp.delay(400)} style={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.md, gap: 8 }}>
        <GradientButton label="Get started" arrow onPress={() => { haptic.soft(); router.push('/setup'); }} />
        <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>For adults 18+ only. By continuing you accept the Community Guidelines.</T>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  hero: { alignItems: 'center', justifyContent: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32, paddingBottom: 20 },
  logo: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  brand: { fontFamily: fonts.extrabold, fontSize: 24, letterSpacing: 4, color: colors.white, marginTop: -10 },
  title: { fontFamily: fonts.extrabold, fontSize: 26, letterSpacing: -0.6, color: colors.text },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pointIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  pointTitle: { fontFamily: fonts.bold, fontSize: 15.5, color: colors.text },
});
