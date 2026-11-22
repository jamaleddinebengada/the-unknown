import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { usePersonMeta } from '@/hooks/usePersonMeta';
import { MaskLogo } from './Brand';

/** Warm, seed-based gradient pairs so anonymous members stay recognisable without a photo. */
const PALETTES: [string, string][] = [
  ['#FFF1B8', '#FFD633'], ['#FFE2D6', '#FF9A85'], ['#EAF6FF', '#7FB8DD'], ['#FFF8E7', '#E0D9C2'],
  ['#FFF6D6', '#FFC800'], ['#EAF7F1', '#7FD3B0'], ['#FFEDE8', '#FF806B'],
];
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

/** Anonymous fallback: gradient disc with the brand mask (no cartoon faces). */
export const MaskAvatar = memo(function MaskAvatar({ seed, size }: { seed: string; size: number }) {
  const p = PALETTES[hash(seed || 'x') % PALETTES.length];
  return (
    <LinearGradient colors={p} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.22)', height: size * 0.5 }]} />
      <MaskLogo size={size * 0.62} tone="ink" />
    </LinearGradient>
  );
});

/**
 * Member avatar. Shows the member's real photo when they allow it (public, or after a
 * mutual reveal with you); otherwise the anonymous mask. Pass `photoUrl` to force a photo.
 */
export const PersonAvatar = memo(function PersonAvatar({ seed, number, size = 42, ring = true, photoUrl, online, style }: {
  seed: string; number?: number | null; size?: number; ring?: boolean; photoUrl?: string | null; online?: boolean; style?: StyleProp<ViewStyle>;
}) {
  const meta = usePersonMeta(photoUrl ? null : number);
  const url = photoUrl ?? meta?.photoUrl ?? null;
  const o = useSharedValue(url ? 1 : 0);
  useEffect(() => { o.value = withTiming(url ? 1 : 0, { duration: 350 }); }, [url, o]);
  const fade = useAnimatedStyle(() => ({ opacity: o.value }));
  const b = ring ? Math.max(2, size * 0.045) : 0;
  const inner = size - b * 2;
  const vip = meta?.tier === 'vip';
  return (
    <View style={[{ width: size, height: size }, style]}>
      <View style={[{ width: size, height: size, borderRadius: size / 2, padding: b, backgroundColor: vip ? '#FFD633' : '#FFFFFF' }, ring && s.shadow]}>
        <MaskAvatar seed={seed} size={inner} />
        {url && (
          <Animated.View style={[{ position: 'absolute', left: b, top: b, width: inner, height: inner, borderRadius: inner / 2, overflow: 'hidden' }, fade]}>
            <Image source={{ uri: url }} style={{ width: inner, height: inner }} contentFit="cover" transition={200} cachePolicy="memory-disk" accessibilityIgnoresInvertColors />
          </Animated.View>
        )}
      </View>
      {online && <View style={[s.dot, { width: size * 0.26, height: size * 0.26, borderRadius: size * 0.13 }]} />}
    </View>
  );
});

const s = StyleSheet.create({
  shadow: { shadowColor: '#25324A', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  dot: { position: 'absolute', right: 0, bottom: 0, backgroundColor: '#2FBF8A', borderWidth: 2, borderColor: '#FFFFFF' },
});
