import { useEffect, useId } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Path, RadialGradient, Stop, LinearGradient } from 'react-native-svg';
import { colors, fonts } from '@/constants/theme';
import { T } from './ui';

/** The portal mark: concentric glowing rings with a hidden question mark. */
export function PortalMark({ size = 120, spin = true }: { size?: number; spin?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = useSharedValue(0);
  const p = useSharedValue(0.85);
  useEffect(() => {
    if (!spin) return;
    r.value = withRepeat(withTiming(360, { duration: 14000, easing: Easing.linear }), -1);
    p.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [spin, r, p]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  const pulse = useAnimatedStyle(() => ({ opacity: p.value, transform: [{ scale: 0.96 + p.value * 0.04 }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, pulse]}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Defs>
            <RadialGradient id={`core${uid}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#1B1640" />
              <Stop offset="0.7" stopColor="#090B14" />
              <Stop offset="0.86" stopColor="#172339" stopOpacity="0.85" />
              <Stop offset="1" stopColor="#FF5277" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx="60" cy="60" r="58" fill={`url(#core${uid})`} />
          <Path d="M50 46c0-6 4.6-10 10.4-10C66 36 70 40 70 45.4c0 4.4-2.6 6.6-5.6 8.6-2.8 1.9-4.4 3.4-4.4 7v1.6"
            stroke={colors.violetSoft} strokeOpacity={0.9} strokeWidth={5} strokeLinecap="round" fill="none" />
          <Circle cx="60" cy="76" r="3.4" fill={colors.cyan} />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', width: size, height: size }, ring]}>
        <Svg width={size} height={size} viewBox="0 0 120 120">
          <Defs>
            <LinearGradient id={`ring${uid}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FF5277" />
              <Stop offset="0.5" stopColor="#FF5277" />
              <Stop offset="1" stopColor="#168AF7" stopOpacity="0.1" />
            </LinearGradient>
          </Defs>
          <Circle cx="60" cy="60" r="50" stroke={`url(#ring${uid})`} strokeWidth={2.4} fill="none" strokeDasharray="210 104" strokeLinecap="round" />
          <Circle cx="60" cy="60" r="43" stroke={`url(#ring${uid})`} strokeWidth={1} fill="none" strokeOpacity={0.5} strokeDasharray="40 30" />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function Wordmark({ size = 28 }: { size?: number }) {
  return (
    <T style={{ fontFamily: fonts.extrabold, fontSize: size, letterSpacing: size * 0.22, color: colors.text }}>
      THE UNKNOWN
    </T>
  );
}
