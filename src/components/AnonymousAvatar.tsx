import { memo, useMemo } from 'react';
import Svg, { Circle, Defs, Path, RadialGradient, Stop, LinearGradient as SvgLinear } from 'react-native-svg';
import { seeded } from '@/utils/format';

const PALETTES = [
  ['#6D4AFF', '#A855F7', '#38BDF8'],
  ['#8B5CF6', '#67E8F9', '#1B1640'],
  ['#38BDF8', '#6D4AFF', '#A78BFA'],
  ['#A855F7', '#FB7185', '#6D4AFF'],
  ['#34D399', '#38BDF8', '#6D4AFF'],
  ['#A78BFA', '#38BDF8', '#090B14'],
];

/**
 * Deterministic "mystery orb" avatar: a glowing portal with a faint hidden silhouette.
 * Same seed → same avatar, so anonymous users stay recognisable without revealing identity.
 */
export const AnonymousAvatar = memo(function AnonymousAvatar({ seed, size = 42, revealed = false }: { seed: string; size?: number; revealed?: boolean }) {
  const cfg = useMemo(() => {
    const r = seeded(seed || 'unknown');
    const pal = PALETTES[Math.floor(r() * PALETTES.length)];
    return { pal, cx: 30 + r() * 40, cy: 25 + r() * 30, rot: Math.floor(r() * 360), ring: 0.25 + r() * 0.35, id: `a${seed}${size}` };
  }, [seed, size]);
  const { pal, id } = cfg;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={`${id}g`} cx={`${cfg.cx}%`} cy={`${cfg.cy}%`} r="75%">
          <Stop offset="0" stopColor={pal[1]} stopOpacity="1" />
          <Stop offset="0.55" stopColor={pal[0]} stopOpacity="0.9" />
          <Stop offset="1" stopColor="#090B14" stopOpacity="1" />
        </RadialGradient>
        <SvgLinear id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={pal[2]} stopOpacity="0.9" />
          <Stop offset="1" stopColor={pal[0]} stopOpacity="0.1" />
        </SvgLinear>
      </Defs>
      <Circle cx="50" cy="50" r="49" fill={`url(#${id}g)`} />
      <Circle cx="50" cy="50" r="44" fill="none" stroke={`url(#${id}r)`} strokeWidth={2.5} strokeOpacity={cfg.ring + 0.3}
        strokeDasharray="60 18" transform={`rotate(${cfg.rot} 50 50)`} />
      {/* hidden silhouette */}
      <Path d="M50 30a12 12 0 1 1 0 24a12 12 0 1 1 0-24zM27 80c2-13 12-20 23-20s21 7 23 20" fill={revealed ? '#F8FAFC' : '#090B14'}
        fillOpacity={revealed ? 0.85 : 0.38} />
    </Svg>
  );
});
