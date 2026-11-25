import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useId } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { MaskAvatar } from './PersonAvatar';
import Svg, { Circle, Defs, G, Path, Polygon, RadialGradient, Stop, LinearGradient as SvgLinear, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '@/constants/theme';

const uid = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');

function useSpin(duration: number, reverse = false) {
  const r = useSharedValue(0);
  useEffect(() => { r.value = withRepeat(withTiming(reverse ? -360 : 360, { duration, easing: Easing.linear }), -1); }, [r, duration, reverse]);
  return useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
}

function useFloat(amp = 6, duration = 2200, delay = 0) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration, easing: Easing.inOut(Easing.sin) })), -1));
  }, [t, duration, delay]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: -amp * t.value }, { rotate: `${(t.value - 0.5) * 8}deg` }] }));
}

/** Spiral arm path: r grows from r0 to r1 while the angle sweeps `turns` revolutions. */
function spiral(cx: number, cy: number, r0: number, r1: number, start: number, turns: number) {
  const pts: string[] = [];
  const steps = 64;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + t * turns * Math.PI * 2;
    const r = r0 + (r1 - r0) * t;
    pts.push(`${i === 0 ? 'M' : 'L'}${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return pts.join(' ');
}

/* =====================================================================
 * Vortex — the swirling 3D portal from the Discovery screen.
 * ===================================================================== */
export const Vortex = memo(function Vortex({ size = 220 }: { size?: number }) {
  const id = uid(useId());
  const c = size / 2;
  const slow = useSpin(16000);
  const mid = useSpin(9000);
  const fast = useSpin(5200);
  const pulse = useSharedValue(0);
  useEffect(() => { pulse.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true); }, [pulse]);
  const core = useAnimatedStyle(() => ({ opacity: 0.75 + pulse.value * 0.25, transform: [{ scale: 0.94 + pulse.value * 0.08 }] }));
  const arms = (n: number, r0: number, r1: number, turns: number, offset: number) =>
    Array.from({ length: n }, (_, i) => spiral(c, c, r0, r1, offset + (i / n) * Math.PI * 2, turns));
  return (
    <View style={{ width: size, height: size }}>
      {/* outer halo */}
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
            <Stop offset="0.35" stopColor="#BFDBFE" stopOpacity="0.55" />
            <Stop offset="0.7" stopColor="#172339" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#FF5277" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill={`url(#${id}h)`} />
      </Svg>
      {/* thick outer swirl */}
      <Animated.View style={[StyleSheet.absoluteFill, slow]}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinear id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#D6EBFF" />
              <Stop offset="0.5" stopColor="#168AF7" />
              <Stop offset="1" stopColor="#FB923C" />
            </SvgLinear>
          </Defs>
          {arms(5, size * 0.12, size * 0.46, 0.55, 0).map((d, i) => (
            <Path key={i} d={d} stroke={`url(#${id}a)`} strokeWidth={size * 0.075} strokeLinecap="round" fill="none" opacity={0.9} />
          ))}
        </Svg>
      </Animated.View>
      {/* candy middle swirl */}
      <Animated.View style={[StyleSheet.absoluteFill, mid]}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinear id={`${id}b`} x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor="#FDBA74" />
              <Stop offset="0.5" stopColor="#F97316" />
              <Stop offset="1" stopColor="#818CF8" />
            </SvgLinear>
          </Defs>
          {arms(4, size * 0.08, size * 0.36, 0.7, 0.6).map((d, i) => (
            <Path key={i} d={d} stroke={`url(#${id}b)`} strokeWidth={size * 0.045} strokeLinecap="round" fill="none" opacity={0.85} />
          ))}
        </Svg>
      </Animated.View>
      {/* bright inner swirl */}
      <Animated.View style={[StyleSheet.absoluteFill, fast]}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinear id={`${id}c`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#93C5FD" />
              <Stop offset="1" stopColor="#FDBA74" />
            </SvgLinear>
          </Defs>
          {arms(3, size * 0.04, size * 0.25, 0.85, 1.2).map((d, i) => (
            <Path key={i} d={d} stroke={`url(#${id}c)`} strokeWidth={size * 0.022} strokeLinecap="round" fill="none" opacity={0.9} />
          ))}
        </Svg>
      </Animated.View>
      {/* glowing core */}
      <Animated.View style={[StyleSheet.absoluteFill, core]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={`${id}k`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="0.25" stopColor="#BFDBFE" stopOpacity="0.95" />
              <Stop offset="0.6" stopColor="#168AF7" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#172339" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={size * 0.17} fill={`url(#${id}k)`} />
        </Svg>
      </Animated.View>
    </View>
  );
});

/* =====================================================================
 * Star — glossy 3D gold (or violet) star that bobs.
 * ===================================================================== */
const STAR = (cx: number, cy: number, R: number, r: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? R : r;
    return `${(cx + Math.cos(a) * rad).toFixed(1)},${(cy + Math.sin(a) * rad).toFixed(1)}`;
  }).join(' ');

export function Star3D({ size = 34, tone = 'gold', delay = 0, style }: { size?: number; tone?: 'gold' | 'violet' | 'blue'; delay?: number; style?: StyleProp<ViewStyle> }) {
  const id = uid(useId());
  const f = useFloat(5, 1800 + delay / 3, delay);
  const g = tone === 'gold' ? ['#FFF3B0', '#FBBF24', '#D97706'] : tone === 'violet' ? ['#EAF5FF', '#FF5277', '#0B6FD1'] : ['#CFFAFE', '#FF5277', '#172339'];
  const c = size / 2;
  return (
    <Animated.View style={[{ width: size, height: size }, f, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinear id={id} x1="0.2" y1="0" x2="0.8" y2="1">
            <Stop offset="0" stopColor={g[0]} />
            <Stop offset="0.5" stopColor={g[1]} />
            <Stop offset="1" stopColor={g[2]} />
          </SvgLinear>
        </Defs>
        <Polygon points={STAR(c, c + 1.5, c * 0.98, c * 0.45)} fill={g[2]} opacity={0.6} />
        <Polygon points={STAR(c, c, c * 0.95, c * 0.44)} fill={`url(#${id})`} stroke="rgba(255,255,255,0.55)" strokeWidth={1} />
        <Circle cx={c * 0.78} cy={c * 0.72} r={c * 0.12} fill="#FFFFFF" opacity={0.7} />
      </Svg>
    </Animated.View>
  );
}

export function Sparkle({ size = 14, color = '#FDE68A', delay = 0, style }: { size?: number; color?: string; delay?: number; style?: StyleProp<ViewStyle> }) {
  const o = useSharedValue(0.3);
  useEffect(() => { o.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0.25, { duration: 900 })), -1)); }, [o, delay]);
  const a = useAnimatedStyle(() => ({ opacity: o.value, transform: [{ scale: 0.7 + o.value * 0.4 }, { rotate: `${o.value * 45}deg` }] }));
  const c = size / 2;
  return (
    <Animated.View style={[{ width: size, height: size }, a, style]}>
      <Svg width={size} height={size}>
        <Path d={`M${c} 0 Q${c * 1.1} ${c * 0.9} ${size} ${c} Q${c * 1.1} ${c * 1.1} ${c} ${size} Q${c * 0.9} ${c * 1.1} 0 ${c} Q${c * 0.9} ${c * 0.9} ${c} 0Z`} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/* =====================================================================
 * EmojiAvatar — playful 3D-style character bubble (decorative / personas).
 * ===================================================================== */

export const EmojiAvatar = memo(function EmojiAvatar({ seed, size = 44, ring = true, float = false, delay = 0, gender, ringColor = '#FFFFFF' }: { seed: string; size?: number; ring?: boolean; float?: boolean; delay?: number; gender?: string | null; ringColor?: string }) {
  const f = useFloat(float ? 6 : 0, 2000 + delay / 2, delay);
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2 }, ring && { borderWidth: Math.max(2, size * 0.05), borderColor: ringColor }, styles.avatarShadow, f]}>
      <MaskAvatar seed={seed} size={ring ? size - Math.max(2, size * 0.05) * 2 : size} />
    </Animated.View>
  );
});

export function AvatarStack({ seeds, size = 30 }: { seeds: string[]; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {seeds.map((s, i) => (
        <View key={s + i} style={{ marginLeft: i === 0 ? 0 : -size * 0.32, zIndex: seeds.length - i }}>
          <EmojiAvatar seed={s} size={size} />
        </View>
      ))}
    </View>
  );
}

/* =====================================================================
 * IsoCubes — stacked isometric 3D blocks with a star on top.
 * ===================================================================== */
function Cube({ x, y, s, top, left, right }: { x: number; y: number; s: number; top: string; left: string; right: string }) {
  const h = s * 0.5;
  return (
    <G>
      <Polygon points={`${x},${y} ${x + s},${y + h} ${x},${y + 2 * h} ${x - s},${y + h}`} fill={top} />
      <Polygon points={`${x - s},${y + h} ${x},${y + 2 * h} ${x},${y + 2 * h + s} ${x - s},${y + h + s}`} fill={left} />
      <Polygon points={`${x + s},${y + h} ${x},${y + 2 * h} ${x},${y + 2 * h + s} ${x + s},${y + h + s}`} fill={right} />
    </G>
  );
}

export function IsoCubes({ size = 120 }: { size?: number }) {
  const f = useFloat(4, 2600);
  const u = size / 6;
  return (
    <Animated.View style={[{ width: size, height: size * 1.05 }, f]}>
      <Svg width={size} height={size * 1.05} viewBox={`0 0 ${size} ${size * 1.05}`}>
        <Cube x={u * 2} y={u * 2.6} s={u * 1.3} top="#F9A8D4" left="#EC4899" right="#BE185D" />
        <Cube x={u * 4.1} y={u * 2.2} s={u * 1.2} top="#EAF5FF" left="#FF5277" right="#172339" />
        <Cube x={u * 3.1} y={u * 3.4} s={u * 1.2} top="#FDE68A" left="#F59E0B" right="#B45309" />
        <Cube x={u * 3.0} y={u * 0.9} s={u * 1.05} top="#D6EBFF" left="#06B6D4" right="#0E7490" />
      </Svg>
      <Star3D size={u * 1.7} style={{ position: 'absolute', left: u * 2.15, top: -u * 0.55 }} />
    </Animated.View>
  );
}

/* =====================================================================
 * Trophy + small helpers
 * ===================================================================== */
export function Trophy({ size = 56 }: { size?: number }) {
  const f = useFloat(4, 2000);
  return (
    <Animated.View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, f]}>
      <View style={[StyleSheet.absoluteFill, { borderRadius: size, backgroundColor: 'rgba(251,191,36,0.25)', transform: [{ scale: 1.1 }] }]} />
      <Text style={{ fontSize: size * 0.78 }}>🏆</Text>
    </Animated.View>
  );
}

export function StarRating({ value, max = 5, size = 14 }: { value: number; max?: number; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {Array.from({ length: max }, (_, i) => (
        <Text key={i} style={{ fontSize: size, color: i < value ? '#FBBF24' : '#D6D9E4' }}>★</Text>
      ))}
    </View>
  );
}

/** "THE UNKNOWN ACTIVE" style status pill with a live dot. */
export function StatusPill({ label, live = true }: { label: string; live?: boolean }) {
  const o = useSharedValue(0.4);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 900 }), -1, true); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return (
    <View style={styles.pill}>
      <Animated.View style={[styles.dot, { backgroundColor: live ? colors.success : colors.textMuted }, live && a]} />
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatarShadow: { shadowColor: '#1E2540', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  avatarGloss: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.22)' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#172339', shadowOpacity: 0.1, shadowRadius: 8, elevation: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  planet: { position: 'absolute', borderRadius: 999, shadowColor: '#168AF7', shadowOpacity: 0.8, shadowRadius: 10, elevation: 4 },
  pillText: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 1, color: colors.text },
});

/* =====================================================================
 * GoldTitle — chunky embossed 3D headline (gold, or gold → pink).
 * Draws a dark extruded copy under a gradient face, like a game logo.
 * ===================================================================== */
type TitleTone = 'gold' | 'pink' | 'orange' | 'navy' | 'blue';
const TONES: Record<TitleTone, { g: [string, string, string]; depth: string }> = {
  gold: { g: ['#EAF5FF', '#FFC94A', '#F08A0C'], depth: '#6B3300' },
  pink: { g: ['#FFD1EC', '#F472B6', '#C026D3'], depth: '#6B0F4F' },
  orange: { g: ['#FFB067', '#FF5277', '#0B6FD1'], depth: '#7A1F05' },
  navy: { g: ['#3B4566', '#1E2540', '#0F1428'], depth: '#9AA3C0' },
  blue: { g: ['#D6EBFF', '#0B6FD1', '#172339'], depth: '#0B2A7A' },
};
export function GoldTitle({ lines, size = 34, width, pinkLast = false, tones }: { lines: string[]; size?: number; width: number; pinkLast?: boolean; tones?: TitleTone[] }) {
  const id = uid(useId());
  const lh = size * 1.12;
  const h = lh * lines.length + size * 0.35;
  return (
    <Svg width={width} height={h} accessibilityLabel={lines.join(' ')}>
      <Defs>
        {(Object.keys(TONES) as TitleTone[]).map((k) => (
          <SvgLinear key={k} id={`${id}${k}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={TONES[k].g[0]} />
            <Stop offset="0.5" stopColor={TONES[k].g[1]} />
            <Stop offset="1" stopColor={TONES[k].g[2]} />
          </SvgLinear>
        ))}
      </Defs>
      {lines.map((line, i) => {
        const y = size + i * lh;
        const tone: TitleTone = tones?.[i] ?? (pinkLast && i === lines.length - 1 ? 'pink' : 'gold');
        const fill = `url(#${id}${tone})`;
        const depth = TONES[tone].depth;
        return (
          <G key={line + i}>
            <SvgText x={width / 2} y={y + size * 0.09} textAnchor="middle" fontFamily={fonts.display} fontSize={size} letterSpacing={1} fill={depth}>{line}</SvgText>
            <SvgText x={width / 2} y={y + size * 0.05} textAnchor="middle" fontFamily={fonts.display} fontSize={size} letterSpacing={1} fill={depth} opacity={0.8}>{line}</SvgText>
            <SvgText x={width / 2} y={y} textAnchor="middle" fontFamily={fonts.display} fontSize={size} letterSpacing={1} fill={fill} stroke="rgba(255,255,255,0.35)" strokeWidth={0.6}>{line}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

/* =====================================================================
 * GlassShard — translucent crystal fragment drifting around the vortex.
 * ===================================================================== */
export function GlassShard({ w = 18, h = 30, rotate = 20, delay = 0, style }: { w?: number; h?: number; rotate?: number; delay?: number; style?: StyleProp<ViewStyle> }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 2600, easing: Easing.inOut(Easing.sin) }), withTiming(0, { duration: 2600, easing: Easing.inOut(Easing.sin) })), -1));
  }, [t, delay]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: -8 * t.value }, { rotate: `${rotate + t.value * 18}deg` }], opacity: 0.55 + t.value * 0.35 }));
  return (
    <Animated.View style={[{ position: 'absolute', width: w, height: h }, a, style]}>
      <LinearGradient colors={['rgba(255,255,255,0.75)', 'rgba(186,230,253,0.35)', 'rgba(22,138,247,0.25)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={{ flex: 1, borderRadius: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.8)' }} />
    </Animated.View>
  );
}

/* =====================================================================
 * OrbitBackdrop — tilted orbit rings with small planets (profile hero).
 * ===================================================================== */
export function OrbitBackdrop({ width, height }: { width: number; height: number }) {
  const spin = useSpin(30000);
  const spin2 = useSpin(22000, true);
  const cx = width / 2;
  const cy = height / 2;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <G transform={`rotate(-14 ${cx} ${cy})`}>
          <Path d={`M ${cx - width * 0.48} ${cy} A ${width * 0.48} ${height * 0.3} 0 1 0 ${cx + width * 0.48} ${cy} A ${width * 0.48} ${height * 0.3} 0 1 0 ${cx - width * 0.48} ${cy}`} stroke="rgba(22,138,247,0.35)" strokeWidth={1.2} fill="none" />
          <Path d={`M ${cx - width * 0.36} ${cy} A ${width * 0.36} ${height * 0.42} 0 1 0 ${cx + width * 0.36} ${cy} A ${width * 0.36} ${height * 0.42} 0 1 0 ${cx - width * 0.36} ${cy}`} stroke="rgba(255,229,138,0.22)" strokeWidth={1} fill="none" />
        </G>
      </Svg>
      <Animated.View style={[StyleSheet.absoluteFill, spin]}>
        <View style={[styles.planet, { left: cx - width * 0.42, top: cy - 20, width: 22, height: 22, backgroundColor: '#168AF7' }]} />
        <View style={[styles.planet, { left: cx + width * 0.3, top: cy + height * 0.2, width: 10, height: 10, backgroundColor: '#FF5277' }]} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, spin2]}>
        <View style={[styles.planet, { left: cx + width * 0.15, top: cy - height * 0.36, width: 34, height: 34, backgroundColor: '#EAF5FF', borderWidth: 1, borderColor: 'rgba(23,35,57,0.3)' }]} />
        <View style={[styles.planet, { left: cx - width * 0.25, top: cy + height * 0.3, width: 8, height: 8, backgroundColor: '#D6EBFF' }]} />
      </Animated.View>
      <Sparkle size={16} color="#EAF5FF" style={{ position: 'absolute', left: width * 0.2, top: height * 0.12 }} />
      <Sparkle size={20} color="#EAF5FF" delay={500} style={{ position: 'absolute', right: width * 0.08, top: height * 0.4 }} />
    </View>
  );
}

/* =====================================================================
 * Couple — illustrated woman & man meeting through the portal.
 * ===================================================================== */
export function Couple({ size = 280 }: { size?: number }) {
  const heart = useFloat(6, 1600);
  const a = size * 0.46;
  return (
    <View style={{ width: size, height: size * 0.78, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ position: 'absolute', opacity: 0.9 }}><Vortex size={size * 0.72} /></View>
      <View style={{ position: 'absolute', left: 0, bottom: size * 0.02 }}><EmojiAvatar seed="welcome-woman-3" gender="woman" size={a} float delay={200} /></View>
      <View style={{ position: 'absolute', right: 0, top: size * 0.02 }}><EmojiAvatar seed="welcome-man-7" gender="man" size={a} float delay={900} /></View>
      <Animated.View style={[{ position: 'absolute', top: size * 0.3, left: size * 0.44 }, heart]}>
        <Text style={{ fontSize: size * 0.11 }}>💜</Text>
      </Animated.View>
      <Star3D size={size * 0.12} style={{ position: 'absolute', left: size * 0.1, top: 0 }} />
      <Star3D size={size * 0.08} tone="violet" delay={500} style={{ position: 'absolute', right: size * 0.06, bottom: size * 0.05 }} />
      <Sparkle size={14} style={{ position: 'absolute', right: size * 0.42, bottom: size * 0.02 }} />
    </View>
  );
}
