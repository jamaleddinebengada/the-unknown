import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useId, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, Polygon, RadialGradient, Stop, LinearGradient as SvgLinear } from 'react-native-svg';
import { colors, fonts } from '@/constants/theme';
import { seeded } from '@/utils/format';

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
            <Stop offset="0.35" stopColor="#8B5CF6" stopOpacity="0.55" />
            <Stop offset="0.7" stopColor="#6D4AFF" stopOpacity="0.18" />
            <Stop offset="1" stopColor="#38BDF8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill={`url(#${id}h)`} />
      </Svg>
      {/* thick outer swirl */}
      <Animated.View style={[StyleSheet.absoluteFill, slow]}>
        <Svg width={size} height={size}>
          <Defs>
            <SvgLinear id={`${id}a`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#C4B5FD" />
              <Stop offset="0.5" stopColor="#8B5CF6" />
              <Stop offset="1" stopColor="#4C1D95" />
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
              <Stop offset="0" stopColor="#F9A8D4" />
              <Stop offset="0.5" stopColor="#E879F9" />
              <Stop offset="1" stopColor="#A78BFA" />
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
              <Stop offset="0" stopColor="#67E8F9" />
              <Stop offset="1" stopColor="#F0ABFC" />
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
              <Stop offset="0.25" stopColor="#F0ABFC" stopOpacity="0.95" />
              <Stop offset="0.6" stopColor="#8B5CF6" stopOpacity="0.4" />
              <Stop offset="1" stopColor="#6D4AFF" stopOpacity="0" />
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
  const g = tone === 'gold' ? ['#FFF3B0', '#FBBF24', '#D97706'] : tone === 'violet' ? ['#F5D0FE', '#C084FC', '#7C3AED'] : ['#CFFAFE', '#38BDF8', '#2563EB'];
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
const FACES = ['🧑🏽', '👩🏻‍🦰', '🧔🏾', '👩🏽‍🦱', '🧑🏻‍🦱', '👱🏼‍♀️', '👨🏻', '👩🏿', '🧑🏼‍🦰', '👲🏻', '🧕🏽', '👩🏼'];
const BUBBLES: [string, string][] = [['#FBCFE8', '#F472B6'], ['#BAE6FD', '#38BDF8'], ['#DDD6FE', '#8B5CF6'], ['#FDE68A', '#F59E0B'], ['#A7F3D0', '#10B981'], ['#FECACA', '#FB7185']];

export const EmojiAvatar = memo(function EmojiAvatar({ seed, size = 44, ring = true, float = false, delay = 0 }: { seed: string; size?: number; ring?: boolean; float?: boolean; delay?: number }) {
  const pick = useMemo(() => { const r = seeded(seed); return { face: FACES[Math.floor(r() * FACES.length)], bg: BUBBLES[Math.floor(r() * BUBBLES.length)] }; }, [seed]);
  const f = useFloat(float ? 6 : 0, 2000 + delay / 2, delay);
  return (
    <Animated.View style={[{ width: size, height: size, borderRadius: size / 2 }, ring && { borderWidth: Math.max(2, size * 0.06), borderColor: '#FFFFFF' }, styles.avatarShadow, f]}>
      <LinearGradient colors={pick.bg} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={[StyleSheet.absoluteFill, { borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }]}>
        <Text style={{ fontSize: size * 0.62, lineHeight: size * 0.8, marginTop: size * 0.06 }}>{pick.face}</Text>
        <View style={[styles.avatarGloss, { borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2, height: size * 0.4 }]} />
      </LinearGradient>
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
        <Cube x={u * 4.1} y={u * 2.2} s={u * 1.2} top="#A5B4FC" left="#6366F1" right="#4338CA" />
        <Cube x={u * 3.1} y={u * 3.4} s={u * 1.2} top="#FDE68A" left="#F59E0B" right="#B45309" />
        <Cube x={u * 3.0} y={u * 0.9} s={u * 1.05} top="#67E8F9" left="#06B6D4" right="#0E7490" />
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
        <Text key={i} style={{ fontSize: size, color: i < value ? '#FBBF24' : 'rgba(255,255,255,0.22)' }}>★</Text>
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
  avatarShadow: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  avatarGloss: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(255,255,255,0.22)' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 7, alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(10,14,40,0.75)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.35)' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  pillText: { fontFamily: fonts.display, fontSize: 12, letterSpacing: 1, color: colors.text },
});
