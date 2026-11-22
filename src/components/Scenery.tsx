import { memo, useId, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, Ellipse, G, LinearGradient as SvgLinear, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

function rng(seed: number) {
  let t = seed >>> 0;
  return () => { t += 0x6d2b79f5; let r = Math.imul(t ^ (t >>> 15), 1 | t); r ^= r + Math.imul(r ^ (r >>> 7), 61 | r); return ((r ^ (r >>> 14)) >>> 0) / 4294967296; };
}
const uid = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');
const PINKS = ['#E2508A', '#F27BA8', '#C13A9F', '#F7B7CF', '#D63F86', '#B5309A'];

/** A cluster of bougainvillea blossoms with a few leaves. */
function Blossoms({ cx, cy, r, n, seed }: { cx: number; cy: number; r: number; n: number; seed: number }) {
  const rand = rng(seed);
  const items = Array.from({ length: n }, () => {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * r;
    return { x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d * 0.8, s: 3 + rand() * 6, c: PINKS[Math.floor(rand() * PINKS.length)], leaf: rand() < 0.18, rot: rand() * 180 };
  });
  return (
    <G>
      {items.map((p, i) =>
        p.leaf ? (
          <Ellipse key={i} cx={p.x} cy={p.y} rx={p.s * 1.1} ry={p.s * 0.5} fill="#6E9A5B" opacity={0.85} transform={`rotate(${p.rot} ${p.x} ${p.y})`} />
        ) : (
          <G key={i}>
            <Circle cx={p.x} cy={p.y} r={p.s} fill={p.c} opacity={0.92} />
            <Circle cx={p.x - p.s * 0.3} cy={p.y - p.s * 0.3} r={p.s * 0.35} fill="#FFFFFF" opacity={0.35} />
          </G>
        ),
      )}
    </G>
  );
}

/** White cubic houses with blue domes, stacked on a cliff (right side). */
function Village({ w, h, base }: { w: number; h: number; base: number }) {
  const rand = rng(7);
  const houses = Array.from({ length: 14 }, (_, i) => {
    const col = i % 7;
    const row = Math.floor(i / 7);
    const x = w * 0.5 + col * w * 0.075 + rand() * 6;
    const hh = h * (0.05 + rand() * 0.04);
    const ww = w * (0.06 + rand() * 0.03);
    const y = base - row * h * 0.06 - col * h * 0.012 - hh;
    return { x, y, ww, hh, dome: rand() < 0.35, win: rand() < 0.7 };
  });
  return (
    <G>
      <Path d={`M ${w * 0.42} ${base + 4} Q ${w * 0.62} ${base - h * 0.2} ${w * 1.02} ${base - h * 0.26} L ${w * 1.02} ${base + 30} Z`} fill="#E9C9B5" />
      {houses.map((p, i) => (
        <G key={i}>
          <Rect x={p.x} y={p.y} width={p.ww} height={p.hh} rx={2} fill="#FFFDFB" />
          <Rect x={p.x} y={p.y + p.hh * 0.75} width={p.ww} height={p.hh * 0.25} fill="#F2E4E8" />
          {p.win && <Rect x={p.x + p.ww * 0.35} y={p.y + p.hh * 0.35} width={p.ww * 0.22} height={p.hh * 0.3} rx={1} fill="#5C86C6" opacity={0.75} />}
          {p.dome && (
            <G>
              <Path d={`M ${p.x + p.ww * 0.15} ${p.y} A ${p.ww * 0.35} ${p.ww * 0.35} 0 0 1 ${p.x + p.ww * 0.85} ${p.y} Z`} fill="#3F6FB5" />
              <Rect x={p.x + p.ww * 0.48} y={p.y - p.ww * 0.5} width={1.5} height={p.ww * 0.18} fill="#FFFDFB" />
            </G>
          )}
        </G>
      ))}
    </G>
  );
}

/**
 * Soft cinematic backdrop: a Mediterranean sunset with a white village and bougainvillea.
 * `flowers` frames the scene with blossoms in the corners.
 */
export const Scenery = memo(function Scenery({ width, height, village = true, flowers = 'both', sun = true, backdrop = true, style }: {
  width: number; height: number; village?: boolean; flowers?: 'both' | 'left' | 'right' | 'bottom' | 'none'; sun?: boolean;
  /** false = blossoms only (a floral frame over the page background) */ backdrop?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const id = uid(useId());
  const horizon = height * 0.58;
  const w = width;
  const h = height;
  const clusters = useMemo(() => {
    const c: { cx: number; cy: number; r: number; n: number; seed: number }[] = [];
    if (flowers === 'both' || flowers === 'left') c.push({ cx: w * 0.02, cy: h * 0.04, r: w * 0.22, n: 70, seed: 1 }, { cx: w * 0.08, cy: h * 0.22, r: w * 0.12, n: 30, seed: 2 });
    if (flowers === 'both' || flowers === 'right') c.push({ cx: w * 0.98, cy: h * 0.03, r: w * 0.2, n: 64, seed: 3 });
    if (flowers === 'both' || flowers === 'bottom') c.push({ cx: w * 0.06, cy: h * 0.96, r: w * 0.2, n: 60, seed: 4 }, { cx: w * 0.94, cy: h * 0.97, r: w * 0.22, n: 66, seed: 5 });
    return c;
  }, [flowers, w, h]);
  return (
    <View pointerEvents="none" style={[{ width, height, overflow: 'hidden' }, style]}>
      <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgLinear id={`${id}sky`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FCE7E6" />
            <Stop offset="0.45" stopColor="#F9C9CF" />
            <Stop offset="1" stopColor="#F3A9B9" />
          </SvgLinear>
          <SvgLinear id={`${id}sea`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#E6A3BE" />
            <Stop offset="0.6" stopColor="#B88BC2" />
            <Stop offset="1" stopColor="#8E6AAE" />
          </SvgLinear>
          <RadialGradient id={`${id}sun`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFF6E0" stopOpacity="1" />
            <Stop offset="0.35" stopColor="#FFD9A8" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#F7A8B8" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        {backdrop && <Rect x={0} y={0} width={w} height={horizon} fill={`url(#${id}sky)`} />}
        {backdrop && sun && <Circle cx={w * 0.38} cy={horizon - h * 0.02} r={h * 0.28} fill={`url(#${id}sun)`} />}
        {backdrop && sun && <Circle cx={w * 0.38} cy={horizon - h * 0.01} r={h * 0.055} fill="#FFF3DA" />}
        {backdrop && <Rect x={0} y={horizon} width={w} height={h - horizon} fill={`url(#${id}sea)`} />}
        {backdrop && sun && [0, 1, 2, 3, 4].map((i) => (
          <Rect key={i} x={w * 0.38 - (w * 0.12) / (i + 1)} y={horizon + 6 + i * h * 0.04} width={(w * 0.24) / (i + 1)} height={2.5} rx={1.2} fill="#FFF1D6" opacity={0.7 - i * 0.12} />
        ))}
        {backdrop && village && <Village w={w} h={h} base={horizon + h * 0.08} />}
        {clusters.map((c, i) => <Blossoms key={i} {...c} />)}
      </Svg>
    </View>
  );
});
