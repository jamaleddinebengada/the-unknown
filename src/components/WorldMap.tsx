import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts } from '@/constants/theme';
import { COUNTRY_POINTS, WORLD_H, WORLD_LAND, WORLD_W } from '@/constants/worldMap';

export interface MapPin { country: string; count: number; online?: boolean }

/** Yellow discovery ripple around a pin. */
function Ripple({ size, delay }: { size: number; delay: number }) {
  const t = useSharedValue(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!reduce) t.set(withDelay(delay, withRepeat(withTiming(1, { duration: 2200, easing: Easing.out(Easing.quad) }), -1)));
  }, [t, delay, reduce]);
  const a = useAnimatedStyle(() => ({ opacity: reduce ? 0.35 : 0.55 * (1 - t.value), transform: [{ scale: reduce ? 1.6 : 0.6 + t.value * 2.2 }] }));
  return <Animated.View pointerEvents="none" style={[s.ripple, { width: size, height: size, borderRadius: size / 2, left: -size / 2, top: -size / 2 }, a]} />;
}

const Pin = memo(function Pin({ p, scale, selected, onPress, i }: { p: MapPin; scale: number; selected: boolean; onPress?: () => void; i: number }) {
  const pt = COUNTRY_POINTS[p.country];
  if (!pt) return null;
  const size = Math.min(34, 16 + p.count * 3);
  return (
    <View style={{ position: 'absolute', left: pt[0] * scale, top: pt[1] * scale }}>
      <Ripple size={size} delay={(i % 5) * 380} />
      <Pressable accessibilityRole="button" accessibilityLabel={`${p.count} people in ${p.country}`} onPress={onPress} hitSlop={12}
        style={[s.dot, { width: size * 0.62, height: size * 0.62, borderRadius: size, left: -size * 0.31, top: -size * 0.31 }, selected && s.dotOn]}>
        {p.count > 1 && <Text style={s.count}>{p.count}</Text>}
      </Pressable>
    </View>
  );
});

/** Light-blue world map with yellow discovery pins. */
export function WorldMap({ width, pins, selected, onSelect }: { width: number; pins: MapPin[]; selected?: string | null; onSelect?: (country: string | null) => void }) {
  const scale = width / WORLD_W;
  const height = WORLD_H * scale;
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${WORLD_W} ${WORLD_H}`}>
        <Path d={WORLD_LAND} fill="#CFE8F7" stroke="#FFFFFF" strokeWidth={0.8} />
      </Svg>
      {pins.map((p, i) => (
        <Pin key={p.country} p={p} i={i} scale={scale} selected={selected === p.country} onPress={() => onSelect?.(selected === p.country ? null : p.country)} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  ripple: { position: 'absolute', backgroundColor: 'rgba(255,214,51,0.55)', borderWidth: 1, borderColor: '#FFC800' },
  dot: { position: 'absolute', backgroundColor: '#FFD633', borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#E5A800', shadowOpacity: 0.5, shadowRadius: 6, elevation: 4 },
  dotOn: { backgroundColor: colors.coral },
  count: { fontFamily: fonts.bold, fontSize: 9.5, color: colors.text },
});
