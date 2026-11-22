import { useId } from 'react';
import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient as SvgLinear, Path, Stop, Ellipse, G } from 'react-native-svg';

/** Royal shield with gold rim and laurels — used for levels and privacy. */
export function ShieldEmblem({ size = 150, icon = '👑' }: { size?: number; icon?: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const leaves = (side: 1 | -1) =>
    Array.from({ length: 7 }, (_, i) => {
      const t = i / 6;
      const a = (-70 + t * 140) * (Math.PI / 180);
      const cx = 100 + side * Math.cos(a) * 92;
      const cy = 112 + Math.sin(a) * 78;
      return <Ellipse key={`${side}${i}`} cx={cx} cy={cy} rx={11} ry={5.5} fill={`url(#${id}g)`} transform={`rotate(${side * (t * 140 - 70) + side * 70} ${cx} ${cy})`} />;
    });
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} viewBox="0 0 200 200" style={{ position: 'absolute' }}>
        <Defs>
          <SvgLinear id={`${id}p`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFB4A4" /><Stop offset="0.55" stopColor="#FF775E" /><Stop offset="1" stopColor="#F05A40" />
          </SvgLinear>
          <SvgLinear id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FFF1B8" /><Stop offset="0.5" stopColor="#FFD83D" /><Stop offset="1" stopColor="#C79200" />
          </SvgLinear>
        </Defs>
        <G>{leaves(1)}{leaves(-1)}</G>
        <Path d="M100 22 L160 44 C160 110 140 150 100 176 C60 150 40 110 40 44 Z" fill={`url(#${id}g)`} />
        <Path d="M100 32 L151 51 C150 108 133 142 100 165 C67 142 50 108 49 51 Z" fill={`url(#${id}p)`} />
        <Path d="M100 32 L151 51 C150 70 147 86 141 100 C120 80 80 70 52 70 C50 63 49 57 49 51 Z" fill="#FFFFFF" opacity={0.12} />
      </Svg>
      <Text style={{ fontSize: size * 0.3, marginTop: -size * 0.04 }}>{icon}</Text>
    </View>
  );
}
