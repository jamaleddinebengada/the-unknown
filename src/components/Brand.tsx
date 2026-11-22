import { memo, useId } from 'react';
import { Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinear, Path, Stop, Ellipse, Circle } from 'react-native-svg';
import { colors, fonts } from '@/constants/theme';

const uid = (s: string) => s.replace(/[^a-zA-Z0-9]/g, '');

/** Masquerade mask — the THE UNKNOWN brand mark (rose → plum with a gold rim). */
export const MaskLogo = memo(function MaskLogo({ size = 64, tone = 'brand' }: { size?: number; tone?: 'brand' | 'gold' | 'white' }) {
  const id = uid(useId());
  const w = size;
  const h = size * 0.52;
  const fill = tone === 'white' ? '#FFFFFF' : `url(#${id}f)`;
  return (
    <Svg width={w} height={h} viewBox="0 0 120 62">
      <Defs>
        <SvgLinear id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={tone === 'gold' ? '#F6E3B4' : '#F27BA8'} />
          <Stop offset="0.5" stopColor={tone === 'gold' ? '#E2BE74' : '#C13A9F'} />
          <Stop offset="1" stopColor={tone === 'gold' ? '#B07C2E' : '#6E1A6B'} />
        </SvgLinear>
        <SvgLinear id={`${id}g`} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#F6E3B4" /><Stop offset="0.5" stopColor="#D9AE5E" /><Stop offset="1" stopColor="#F6E3B4" />
        </SvgLinear>
      </Defs>
      {/* wings + bridge */}
      <Path
        d="M60 20 C52 10 36 4 18 6 C8 7 2 12 1 18 C4 16 8 16 11 18 C9 30 14 46 30 52 C44 57 54 48 60 38 C66 48 76 57 90 52 C106 46 111 30 109 18 C112 16 116 16 119 18 C118 12 112 7 102 6 C84 4 68 10 60 20 Z"
        fill={fill} stroke={tone === 'white' ? 'none' : `url(#${id}g)`} strokeWidth={2.2}
      />
      {/* eye holes */}
      <Ellipse cx="36" cy="30" rx="13" ry="8" fill={tone === 'white' ? colors.violetDeep : '#FFF7F3'} transform="rotate(-8 36 30)" />
      <Ellipse cx="84" cy="30" rx="13" ry="8" fill={tone === 'white' ? colors.violetDeep : '#FFF7F3'} transform="rotate(8 84 30)" />
      <Circle cx="60" cy="24" r="2.6" fill={`url(#${id}g)`} />
    </Svg>
  );
});

/** "THE UNKNOWN" serif wordmark. */
export function Wordmark({ size = 34, color = colors.plum, style }: { size?: number; color?: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ alignItems: 'center' }, style]}>
      <Text style={{ fontFamily: fonts.serif, fontSize: size * 0.62, lineHeight: size * 0.75, color, letterSpacing: 1 }}>THE</Text>
      <Text style={{ fontFamily: fonts.serif, fontSize: size, lineHeight: size * 1.15, color, letterSpacing: 0.5 }}>UNKNOWN</Text>
    </View>
  );
}
