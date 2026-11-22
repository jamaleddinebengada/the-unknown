import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, Path, RadialGradient, Stop } from 'react-native-svg';
import { colors, radius } from '@/constants/theme';
import { AnonymousAvatar } from './AnonymousAvatar';
import { T } from './ui';

function Pulse({ x, y, delay = 0, color = colors.cyan }: { x: number; y: number; delay?: number; color?: string }) {
  const v = useSharedValue(0);
  useEffect(() => { v.value = withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1)); }, [v, delay]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - v.value, transform: [{ scale: 0.6 + v.value * 2.2 }] }));
  return (
    <View style={{ position: 'absolute', left: x - 6, top: y - 6, width: 12, height: 12 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: 6, borderWidth: 1.5, borderColor: color }, ring]} />
      <View style={{ position: 'absolute', left: 3, top: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
  );
}

export function GlobeIllustration({ size = 260 }: { size?: number }) {
  const spin = useSharedValue(0);
  useEffect(() => { spin.value = withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1); }, [spin]);
  const meridians = useAnimatedStyle(() => ({ transform: [{ translateX: (spin.value - 0.5) * 18 }] }));
  const c = size / 2;
  const pts = [[0.3, 0.38, 0], [0.62, 0.3, 500], [0.7, 0.58, 900], [0.42, 0.66, 1300], [0.52, 0.47, 1800]] as const;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="globe" cx="40%" cy="35%" r="70%">
            <Stop offset="0" stopColor="#FFFFFF" />
            <Stop offset="0.7" stopColor="#FFF6D6" />
            <Stop offset="1" stopColor="#C7D2FE" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c - 6} fill="url(#globe)" stroke={colors.violet} strokeOpacity={0.45} strokeWidth={1.2} />
        {[0.25, 0.5, 0.75].map((k) => (
          <Ellipse key={k} cx={c} cy={c} rx={c - 6} ry={(c - 6) * k * 0.55} fill="none" stroke={colors.violetSoft} strokeOpacity={0.15} />
        ))}
        <Path d={`M${size * 0.3} ${size * 0.38} Q ${size * 0.46} ${size * 0.1} ${size * 0.62} ${size * 0.3}`} stroke={colors.cyan} strokeOpacity={0.7} strokeWidth={1.4} fill="none" strokeDasharray="4 5" />
        <Path d={`M${size * 0.62} ${size * 0.3} Q ${size * 0.86} ${size * 0.42} ${size * 0.7} ${size * 0.58}`} stroke={colors.violetSoft} strokeOpacity={0.7} strokeWidth={1.4} fill="none" strokeDasharray="4 5" />
        <Path d={`M${size * 0.42} ${size * 0.66} Q ${size * 0.25} ${size * 0.55} ${size * 0.3} ${size * 0.38}`} stroke={colors.blue} strokeOpacity={0.6} strokeWidth={1.4} fill="none" strokeDasharray="4 5" />
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, meridians]} pointerEvents="none">
        <Svg width={size} height={size}>
          {[0.35, 0.65].map((k) => <Ellipse key={k} cx={c} cy={c} rx={(c - 6) * k} ry={c - 6} fill="none" stroke={colors.violetSoft} strokeOpacity={0.12} />)}
        </Svg>
      </Animated.View>
      {pts.map(([x, y, d], i) => <Pulse key={i} x={x * size} y={y * size} delay={d} color={i % 2 ? colors.violetSoft : colors.cyan} />)}
    </View>
  );
}

function Float({ children, x, y, delay }: { children: React.ReactNode; x: number; y: number; delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => { v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 1800 }), withTiming(0, { duration: 1800 })), -1)); }, [v, delay]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * v.value }], opacity: 0.55 + 0.45 * v.value }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: y }, a]}>{children}</Animated.View>;
}

export function ShareIllustration({ size = 280 }: { size?: number }) {
  const spots = [[0.02, 0.05], [0.78, 0.0], [0.82, 0.72], [0.0, 0.74]] as const;
  return (
    <View style={{ width: size, height: size * 0.85 }}>
      <Svg width={size} height={size * 0.85} style={StyleSheet.absoluteFill}>
        {spots.map(([x, y], i) => (
          <Path key={i} d={`M${size / 2} ${size * 0.42} L${x * size + 26} ${y * size + 26}`} stroke={i % 2 ? colors.violetSoft : colors.cyan} strokeOpacity={0.45} strokeDasharray="3 6" strokeWidth={1.4} />
        ))}
      </Svg>
      {spots.map(([x, y], i) => (
        <Float key={i} x={x * size} y={y * size} delay={i * 400}><AnonymousAvatar seed={`share${i}`} size={52} /></Float>
      ))}
      <View style={[ill.post, { left: size / 2 - 95, top: size * 0.42 - 48 }]}>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <AnonymousAvatar seed="poster" size={26} />
          <T v="caption" color={colors.textSecondary}>UNKNOWN #48291 · 🇲🇦</T>
        </View>
        <T v="caption" style={{ fontSize: 13 }}>“Would you start a new life in another country?”</T>
      </View>
    </View>
  );
}

export function ConnectIllustration({ size = 280 }: { size?: number }) {
  const v = useSharedValue(0);
  useEffect(() => { v.value = withRepeat(withSequence(withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.cubic) }), withDelay(900, withTiming(0, { duration: 1600 }))), -1); }, [v]);
  const left = useAnimatedStyle(() => ({ transform: [{ translateX: v.value * size * 0.16 }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ translateX: -v.value * size * 0.16 }] }));
  const spark = useAnimatedStyle(() => ({ opacity: v.value, transform: [{ scale: 0.4 + v.value * 0.8 }] }));
  return (
    <View style={{ width: size, height: size * 0.6, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: size }}>
        <Animated.View style={left}><AnonymousAvatar seed="you" size={92} /></Animated.View>
        <Animated.View style={[spark, { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.violetGlow, alignItems: 'center', justifyContent: 'center' }]}>
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: colors.cyan }} />
        </Animated.View>
        <Animated.View style={right}><AnonymousAvatar seed="them" size={92} /></Animated.View>
      </View>
    </View>
  );
}

const ill = StyleSheet.create({
  post: { position: 'absolute', width: 190, padding: 12, gap: 8, borderRadius: radius.md, backgroundColor: colors.card, borderWidth: 1, borderColor: 'rgba(255,128,107,0.4)' },
});
