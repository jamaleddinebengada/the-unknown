import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { colors, gradients } from '@/constants/theme';
import { seeded } from '@/utils/format';

const Star = memo(function Star({ x, y, size, delay, dur }: { x: number; y: number; size: number; delay: number; dur: number }) {
  const o = useSharedValue(0.15);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(0.9, { duration: dur, easing: Easing.inOut(Easing.quad) }), withTiming(0.15, { duration: dur })), -1));
  }, [o, delay, dur]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: y, width: size, height: size, borderRadius: size, backgroundColor: size > 2 ? colors.violetSoft : '#FBBF24' }, a]} />;
});

/** Cinematic background: mystery gradient + soft violet light + twinkling particles. */
export function Atmosphere({ stars = 40, intensity = 1 }: { stars?: number; intensity?: number }) {
  const { width, height } = useWindowDimensions();
  const pts = useMemo(() => {
    const r = seeded('the-unknown-sky');
    return Array.from({ length: stars }, () => ({ x: r() * width, y: r() * height, size: r() > 0.85 ? 3 : 1.5, delay: r() * 2500, dur: 1600 + r() * 2400 }));
  }, [stars, width, height]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={gradients.mystery} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 0.3, y: 1 }} />
      <View style={[styles.glow, { width: width * 1.2, height: width * 1.2, left: -width * 0.1, top: -width * 0.55, opacity: 0.55 * intensity }]} />
      <View style={[styles.glowBlue, { width: width * 0.9, height: width * 0.9, right: -width * 0.45, bottom: height * 0.1, opacity: 0.35 * intensity }]} />
      {pts.map((p, i) => <Star key={i} {...p} />)}
    </View>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(226,80,138,0.28)' },
  glowBlue: { position: 'absolute', borderRadius: 9999, backgroundColor: 'rgba(226,80,138,0.16)' },
});
