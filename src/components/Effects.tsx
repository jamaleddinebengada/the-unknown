import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useId, useMemo, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing, interpolate, useAnimatedProps, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Stop, LinearGradient as SvgLinear, RadialGradient, Text as SvgText } from 'react-native-svg';
import { colors, fonts, glass, gradients, radius } from '@/constants/theme';
import { seeded } from '@/utils/format';

/* =====================================================================
 * Aurora — slow drifting light blobs behind a screen (cinematic depth).
 * Pure SVG radial gradients moved by Reanimated transforms: no blur cost.
 * ===================================================================== */
const Blob = memo(function Blob({ color, size, x, y, dx, dy, dur, delay, opacity }: {
  color: string; size: number; x: number; y: number; dx: number; dy: number; dur: number; delay: number; opacity: number;
}) {
  const t = useSharedValue(0);
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration: dur, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [t, dur, delay]);
  const a = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(t.value, [0, 1], [0, dx]) },
      { translateY: interpolate(t.value, [0, 1], [0, dy]) },
      { scale: interpolate(t.value, [0, 0.5, 1], [1, 1.15, 0.95]) },
    ],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2, width: size, height: size, opacity }, a]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity="0.9" />
            <Stop offset="0.45" stopColor={color} stopOpacity="0.35" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
});

const Spark = memo(function Spark({ x, y, s, delay, dur }: { x: number; y: number; s: number; delay: number; dur: number }) {
  const o = useSharedValue(0);
  useEffect(() => {
    o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: dur }), withTiming(0.1, { duration: dur })), -1));
  }, [o, delay, dur]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ translateY: -6 * o.value }] }));
  return <Animated.View style={[{ position: 'absolute', left: x, top: y, width: s, height: s, borderRadius: s, backgroundColor: s > 2.4 ? '#FFD633' : '#FFEFB0' }, a]} />;
});

export function Aurora({ variant = 'default', stars = 26, style }: { variant?: 'default' | 'warm' | 'calm'; stars?: number; style?: StyleProp<ViewStyle> }) {
  const { width, height } = useWindowDimensions();
  const palette = variant === 'warm' ? ['#FFE89A', '#FFF1B8', '#FFD3C9'] : variant === 'calm' ? ['#EAF6FF', '#FFF6D6', '#FFF8E7'] : ['#FFF1B8', '#EAF6FF', '#FFE2D6'];
  const sparks = useMemo(() => {
    const r = seeded(`aurora-${variant}`);
    return Array.from({ length: stars }, () => ({ x: r() * width, y: r() * height, s: r() > 0.8 ? 3 : 1.6, delay: r() * 3000, dur: 1800 + r() * 2600 }));
  }, [stars, width, height, variant]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, style]}>
      <LinearGradient colors={gradients.mystery} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />
      <Blob color={palette[0]} size={width * 1.3} x={width * 0.15} y={height * 0.05} dx={width * 0.25} dy={height * 0.06} dur={9000} delay={0} opacity={0.55} />
      <Blob color={palette[1]} size={width * 1.0} x={width * 0.95} y={height * 0.35} dx={-width * 0.3} dy={height * 0.08} dur={11000} delay={600} opacity={0.32} />
      <Blob color={palette[2]} size={width * 1.1} x={width * 0.2} y={height * 0.85} dx={width * 0.3} dy={-height * 0.1} dur={13000} delay={1200} opacity={0.3} />
      <LinearGradient colors={['rgba(255,254,250,0)', 'rgba(255,254,250,0.6)']} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0.3 }} end={{ x: 0, y: 1 }} />
      {sparks.map((p, i) => <Spark key={i} {...p} />)}
    </View>
  );
}

/* =====================================================================
 * GlassCard — translucent surface with a luminous gradient border.
 * ===================================================================== */
export function GlassCard({ children, style, accent, padding = 16, radius: r = radius.lg, glow = false, fill }: {
  children: ReactNode; style?: StyleProp<ViewStyle>; accent?: readonly [string, string]; padding?: number; radius?: number; glow?: boolean; fill?: readonly [string, string];
}) {
  const border = accent ? ([`${accent[0]}CC`, `${accent[1]}40`, 'rgba(255,255,255,0.05)'] as const) : glass.border;
  return (
    <View style={[{ borderRadius: r }, styles.float, glow && styles.glow, style]}>
      <LinearGradient colors={border} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: r, padding: 1 }}>
        <LinearGradient colors={fill ?? glass.fill} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={{ borderRadius: r - 1, padding, overflow: 'hidden' }}>
          <View pointerEvents="none" style={[styles.sheen, { borderTopLeftRadius: r, borderTopRightRadius: r }]} />
          {accent && (
            <LinearGradient pointerEvents="none" colors={[`${accent[0]}1A`, 'rgba(255,255,255,0)']} start={{ x: 0, y: 0 }} end={{ x: 0.7, y: 0.7 }} style={StyleSheet.absoluteFill} />
          )}
          {children}
        </LinearGradient>
      </LinearGradient>
    </View>
  );
}

/* =====================================================================
 * GradientText — headline text filled with a gradient (SVG, no native deps).
 * ===================================================================== */
export function GradientText({ text, size = 30, colors: g = ['#FF806B', '#FF8C73', '#25324A'], weight = fonts.display, letterSpacing = 0.2, width, align = 'left' }: {
  text: string; size?: number; colors?: readonly string[]; weight?: string; letterSpacing?: number; width?: number; align?: 'left' | 'center';
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const w = width ?? Math.ceil(text.length * size * 0.62 + Math.abs(letterSpacing) * text.length);
  const h = Math.ceil(size * 1.3);
  return (
    <Svg width={w} height={h} accessibilityLabel={text}>
      <Defs>
        <SvgLinear id={id} x1="0" y1="0" x2="1" y2="0.4">
          {g.map((c, i) => <Stop key={c + i} offset={g.length === 1 ? 0 : i / (g.length - 1)} stopColor={c} />)}
        </SvgLinear>
      </Defs>
      <SvgText x={align === 'center' ? w / 2 : 0} y={size} textAnchor={align === 'center' ? 'middle' : 'start'} fontFamily={weight}
        fontSize={size} letterSpacing={letterSpacing} fill={`url(#${id})`}>{text}</SvgText>
    </Svg>
  );
}

/* =====================================================================
 * Shimmer — light sweep used by skeleton loaders.
 * ===================================================================== */
export function Shimmer({ style }: { style?: StyleProp<ViewStyle> }) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(-1);
  useEffect(() => { x.value = withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), -1); }, [x]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * width }] }));
  return (
    <View style={[{ overflow: 'hidden', backgroundColor: '#ECE9FB' }, style]}>
      <Animated.View style={[StyleSheet.absoluteFill, a]}>
        <LinearGradient colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: width * 0.7, height: '100%' }} />
      </Animated.View>
    </View>
  );
}

/* =====================================================================
 * HeartBurst — particles exploding from a point (double-tap like).
 * ===================================================================== */
function Particle({ angle, dist, color, trigger }: { angle: number; dist: number; color: string; trigger: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    p.value = 0;
    p.value = withTiming(1, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [trigger, p]);
  const a = useAnimatedStyle(() => ({
    opacity: p.value === 0 ? 0 : 1 - p.value,
    transform: [{ translateX: Math.cos(angle) * dist * p.value }, { translateY: Math.sin(angle) * dist * p.value }, { scale: 1.2 - p.value * 0.6 }],
  }));
  return <Animated.View style={[{ position: 'absolute', width: 8, height: 8, borderRadius: 4, backgroundColor: color }, a]} />;
}

export function HeartBurst({ trigger, size = 90 }: { trigger: number; size?: number }) {
  const heart = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    heart.value = 0;
    heart.value = withSequence(withTiming(1, { duration: 220, easing: Easing.out(Easing.back(2)) }), withDelay(350, withTiming(0, { duration: 260 })));
  }, [trigger, heart]);
  const h = useAnimatedStyle(() => ({ opacity: heart.value, transform: [{ scale: 0.4 + heart.value * 0.8 }] }));
  const parts = useMemo(() => Array.from({ length: 12 }, (_, i) => ({ angle: (i / 12) * Math.PI * 2, dist: size * (0.55 + (i % 3) * 0.15), color: [colors.danger, colors.violetSoft, colors.cyan][i % 3] })), [size]);
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
      {parts.map((pp, i) => <Particle key={i} {...pp} trigger={trigger} />)}
      <Animated.Text style={[{ fontSize: size * 0.7, textShadowColor: colors.danger, textShadowRadius: 24 }, h]}>❤️</Animated.Text>
    </View>
  );
}

/* =====================================================================
 * GlowRing — rotating gradient ring (portal motif) around content.
 * ===================================================================== */
export function GlowRing({ size, children, speed = 6000, thickness = 2.5, colors: g = ['#FF806B', '#FF806B', '#FFD633'] }: {
  size: number; children?: ReactNode; speed?: number; thickness?: number; colors?: readonly string[];
}) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const r = useSharedValue(0);
  useEffect(() => { r.value = withRepeat(withTiming(360, { duration: speed, easing: Easing.linear }), -1); }, [r, speed]);
  const a = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  const R = size / 2 - thickness;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={[StyleSheet.absoluteFill, a]}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinear id={id} x1="0" y1="0" x2="1" y2="1">
              {g.map((c, i) => <Stop key={c + i} offset={i / (g.length - 1)} stopColor={c} stopOpacity={i === g.length - 1 ? 0.15 : 1} />)}
            </SvgLinear>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={R} stroke={`url(#${id})`} strokeWidth={thickness} fill="none" strokeLinecap="round" strokeDasharray={`${R * 4.2} ${R * 2.1}`} />
        </Svg>
      </Animated.View>
      {children}
    </View>
  );
}

/* =====================================================================
 * PulseDot — breathing glow (online / live indicators).
 * ===================================================================== */
export function PulseDot({ color = colors.success, size = 10 }: { color?: string; size?: number }) {
  const p = useSharedValue(0);
  useEffect(() => { p.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1); }, [p]);
  const a = useAnimatedStyle(() => ({ opacity: 1 - p.value, transform: [{ scale: 1 + p.value * 1.8 }] }));
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }, a]} />
      <View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  float: { shadowColor: '#25324A', shadowOpacity: 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 3 },
  sheen: { position: 'absolute', left: 0, right: 0, top: 0, height: 1, backgroundColor: glass.highlight },
  glow: { shadowColor: '#E5A800', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});

/* =====================================================================
 * ScreenTitle — overline + gradient headline used at the top of tabs.
 * ===================================================================== */
export function ScreenTitle({ overline, title, subtitle, right }: { overline?: string; title: string; subtitle?: string; right?: ReactNode }) {
  const { width } = useWindowDimensions();
  const size = Math.min(30, (width - 32) / Math.max(10, title.length * 0.58));
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <View style={{ flex: 1, gap: 4 }}>
          {overline && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <LinearGradient colors={gradients.secondary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: 18, height: 2, borderRadius: 1 }} />
              <Animated.Text style={{ fontFamily: fonts.semibold, fontSize: 11.5, letterSpacing: 2.2, color: colors.violetSoft }}>{overline}</Animated.Text>
            </View>
          )}
          <Animated.Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: fonts.bold, fontSize: Math.max(24, size), letterSpacing: -0.6, color: colors.text }}>{title}</Animated.Text>
        </View>
        {right}
      </View>
      {subtitle && <Animated.Text style={{ fontFamily: fonts.regular, fontSize: 14.5, lineHeight: 21, color: colors.textSecondary }}>{subtitle}</Animated.Text>}
    </View>
  );
}

/** Concentric yellow discovery rings that expand and fade (static when Reduce Motion is on). */
export function DiscoveryRings({ size, count = 3, color = '#FFD633', style }: { size: number; count?: number; color?: string; style?: object }) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
      {Array.from({ length: count }, (_, i) => <Ring key={i} size={size} delay={(i * 2600) / count} color={color} />)}
    </View>
  );
}
function Ring({ size, delay, color }: { size: number; delay: number; color: string }) {
  const t = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => { if (!reduce) t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1))); }, [t, delay, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: reduce ? 0.25 : 0.7 * (1 - t.value), transform: [{ scale: reduce ? 0.8 : 0.35 + t.value * 0.75 }] }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: 3, borderColor: color, backgroundColor: `${color}22` }, a]} />;
}

/** Gentle floating motion for cards (phase-shifted by index). */
export function Float({ children, index = 0, amplitude = 4, style }: { children: ReactNode; index?: number; amplitude?: number; style?: object }) {
  const t = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!reduce) t.set(withDelay((index % 4) * 450, withRepeat(withTiming(1, { duration: 3200 + (index % 3) * 400, easing: Easing.inOut(Easing.sin) }), -1, true)));
  }, [t, index, reduce]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -amplitude * t.value }] }));
  return <Animated.View style={[style, a]}>{children}</Animated.View>;
}

/** Animated progress ring (yellow on cream). */
export function ProgressRing({ size = 64, stroke = 7, progress, children, color = '#FFC800', track = '#F4EEDB' }: {
  size?: number; stroke?: number; progress: number; children?: ReactNode; color?: string; track?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => { p.set(reduce ? progress : withTiming(Math.max(0, Math.min(1, progress)), { duration: 900, easing: Easing.out(Easing.cubic) })); }, [progress, reduce, p]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`} animatedProps={props} />
      </Svg>
      {children}
    </View>
  );
}
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Subtle confetti burst (yellow / coral / sky). Renders nothing when Reduce Motion is on. */
export function Confetti({ trigger, width = 320 }: { trigger: number; width?: number }) {
  const reduce = useReducedMotion();
  if (!trigger || reduce) return null;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      {Array.from({ length: 22 }, (_, i) => <Piece key={`${trigger}-${i}`} i={i} width={width} />)}
    </View>
  );
}
function Piece({ i, width }: { i: number; width: number }) {
  const t = useSharedValue(0);
  const x0 = ((i * 53) % 100) / 100 * width;
  const drift = ((i * 37) % 60) - 30;
  const color = ['#FFD633', '#FF806B', '#7FB8DD', '#FFC800'][i % 4];
  useEffect(() => { t.set(withDelay((i % 6) * 60, withTiming(1, { duration: 1400 + (i % 5) * 120, easing: Easing.out(Easing.quad) }))); }, [t, i]);
  const a = useAnimatedStyle(() => ({ opacity: 1 - t.value * t.value, transform: [{ translateX: x0 + drift * t.value }, { translateY: -20 + t.value * 260 }, { rotate: `${t.value * (i % 2 ? 260 : -260)}deg` }] }));
  return <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: 8, height: i % 3 ? 12 : 8, borderRadius: i % 3 ? 2 : 4, backgroundColor: color }, a]} />;
}
