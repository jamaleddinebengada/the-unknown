import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaskLogo } from '@/components/Brand';
import { Scenery } from '@/components/Scenery';
import { GradientButton, T } from '@/components/ui';
import { colors, fonts, gradients, spacing } from '@/constants/theme';
import { haptic } from '@/utils/format';

/** Welcome — no sign-up: you enter instantly with an anonymous identity. */
export default function Welcome() {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const heroH = Math.min(height * 0.5, 460);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient colors={gradients.mystery} style={StyleSheet.absoluteFill} />
      <Animated.View entering={FadeIn.duration(900)} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: heroH + 120 }}>
        <Scenery width={width} height={heroH + 120} flowers="bottom" />
        <LinearGradient colors={[colors.bg, 'rgba(255,247,243,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 140 }} />
      </Animated.View>
      <Scenery width={width} height={Math.min(200, height * 0.2)} backdrop={false} flowers="both" style={{ position: 'absolute', top: 0, opacity: 0.85 }} />

      <View style={{ paddingTop: insets.top + Math.min(spacing.xxl, height * 0.03), alignItems: 'center', gap: 6, paddingHorizontal: spacing.xl }}>
        <Animated.View entering={FadeInDown.springify().damping(14)}><MaskLogo size={96} /></Animated.View>
        <Animated.View entering={FadeInDown.delay(120).springify().damping(16)} style={{ alignItems: 'center' }}>
          <Text style={styles.the}>THE</Text>
          <Text style={styles.unknown}>UNKNOWN</Text>
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(220)}>
          <T style={styles.tag}>Meet the unknown.{'\n'}Discover the unexpected.</T>
        </Animated.View>
      </View>

      <Animated.View entering={FadeInUp.delay(300).springify().damping(18)} style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
        <GradientButton label="Get Started" arrow onPress={() => { haptic.soft(); router.push('/vibe'); }} />
        <View style={styles.note}>
          <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
            No account needed — you start with an anonymous identity.{'\n'}18+ only · By continuing you accept the Community Guidelines.
          </T>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  the: { fontFamily: fonts.serif, fontSize: 26, lineHeight: 30, color: colors.plum, letterSpacing: 2 },
  unknown: { fontFamily: fonts.serif, fontSize: 46, lineHeight: 54, color: colors.plum, letterSpacing: 1 },
  tag: { fontFamily: fonts.medium, fontSize: 17, lineHeight: 25, color: colors.text, textAlign: 'center', marginTop: 6 },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.xl, gap: spacing.sm },
  note: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.82)' },
});
