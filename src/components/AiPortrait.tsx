import { createAvatar } from '@dicebear/core';
import { notionists } from '@dicebear/collection';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors, fonts } from '@/constants/theme';

/** Pre-rendered portraits (PNG, rendered from the same CC0 artwork at build time — reliable on every Android device). */
const PORTRAITS: Record<string, number> = {
  'luna-ai': require('../../assets/ai/luna.png'), 'alex-ai': require('../../assets/ai/alex.png'),
  'maya-ai': require('../../assets/ai/maya.png'), 'noah-ai': require('../../assets/ai/noah.png'),
  'sofia-ai': require('../../assets/ai/sofia.png'), 'adam-ai': require('../../assets/ai/adam.png'),
  'emma-ai': require('../../assets/ai/emma.png'), 'leo-ai': require('../../assets/ai/leo.png'),
  'sara-ai': require('../../assets/ai/sara.png'), 'oliver-ai': require('../../assets/ai/oliver.png'),
  'nina-ai': require('../../assets/ai/nina.png'), 'yuki-ai': require('../../assets/ai/yuki.png'),
  'karim-ai': require('../../assets/ai/karim.png'), 'ines-ai': require('../../assets/ai/ines.png'),
  'mateo-ai': require('../../assets/ai/mateo.png'), 'amara-ai': require('../../assets/ai/amara.png'),
  'hugo-ai': require('../../assets/ai/hugo.png'), 'lea-ai': require('../../assets/ai/lea.png'),
  'omar-ai': require('../../assets/ai/omar.png'), 'zara-ai': require('../../assets/ai/zara.png'),
};

/** Original illustrated portrait for a fictional AI character ("Notionists" by Zoish, CC0) + a visible AI badge. */
export const AiPortrait = memo(function AiPortrait({ seed, portrait, accent = '#168AF7', size = 64, badge = false, rounded = 'circle', style }: {
  seed: string; portrait?: string | null; accent?: string; size?: number; badge?: boolean; rounded?: 'circle' | 'card'; style?: StyleProp<ViewStyle>;
}) {
  // Android's SVG renderer drops DiceBear's viewBox <mask>, so strip it (it only clips to the viewBox) and the metadata.
  const asset = PORTRAITS[seed];
  const xml = useMemo(() => (asset ? '' : createAvatar(notionists, { seed }).toString())
    .replace(/<metadata[\s\S]*?<\/metadata>/, '')
    .replace(/<mask[\s\S]*?<\/mask>/g, '')
    .replace(/ mask="url\(#[^)]*\)"/g, ''), [seed, asset]);
  const r = rounded === 'circle' ? size / 2 : Math.min(28, size * 0.16);
  return (
    <View style={[{ width: size, height: size }, style]} accessibilityLabel="AI character portrait">
      <LinearGradient colors={['#FFFFFF', `${accent}55`]} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={{ width: size, height: size, borderRadius: r, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
        {portrait?.startsWith('https://') ? <Image source={{ uri: portrait }} placeholder={asset} style={{ width: size, height: size }} contentFit="cover" transition={200} /> : asset ? <Image source={asset} style={{ width: size, height: size }} contentFit="cover" /> : <SvgXml xml={xml} width={size} height={size} />}
      </LinearGradient>
      {badge && <AiBadge small={size < 70} style={rounded === 'circle' ? { position: 'absolute', right: -4, bottom: -2 } : { position: 'absolute', left: 10, top: 10 }} />}
    </View>
  );
});

export function AiBadge({ small, style }: { small?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.badge, small && { paddingHorizontal: 5, paddingVertical: 1 }, style]} accessibilityLabel="AI character">
      <Text style={[s.text, small && { fontSize: 9 }]}>AI</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, backgroundColor: colors.text, borderWidth: 2, borderColor: '#FFFFFF' },
  text: { fontFamily: fonts.extrabold, fontSize: 11, color: colors.primary, letterSpacing: 0.6 },
});
