import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { usePersonMeta } from '@/hooks/usePersonMeta';
import { fonts } from '@/constants/theme';

/** Warm, seed-based gradient pairs so anonymous members stay recognisable without a photo. */
const PALETTES: [string, string][] = [
  ['#DCEEFF', '#9CCBFA'], ['#E6EAF2', '#AEB9CC'], ['#E3F4EC', '#9FD8BA'], ['#FFE6EC', '#F7A9BC'],
  ['#EFE7FD', '#BFA8EF'], ['#FFF1D6', '#F2C77A'], ['#E1F5F7', '#94D6DF'],
];
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

/** Placeholder when there is no visible photo: soft colour + the name's initial (or a silhouette). */
export const MaskAvatar = memo(function MaskAvatar({ seed, size, name }: { seed: string; size: number; name?: string | null }) {
  const p = PALETTES[hash(seed || 'x') % PALETTES.length];
  const initial = name?.trim()?.[0]?.toUpperCase();
  return (
    <LinearGradient colors={p} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      {initial ? <Text style={{ fontFamily: fonts.bold, fontSize: size * 0.42, color: '#FFFFFF' }}>{initial}</Text>
        : <Ionicons name="person" size={size * 0.56} color="rgba(255,255,255,0.95)" style={{ marginTop: size * 0.12 }} />}
    </LinearGradient>
  );
});

/**
 * Member avatar. Shows the member's real photo when they allow it (public, or after a
 * mutual reveal with you); otherwise the anonymous mask. Pass `photoUrl` to force a photo.
 */
export const PersonAvatar = memo(function PersonAvatar({ seed, number, size = 42, ring = true, photoUrl, online, style, name }: {
  seed: string; number?: number | null; size?: number; ring?: boolean; photoUrl?: string | null; online?: boolean; style?: StyleProp<ViewStyle>; name?: string | null;
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
      <View style={[{ width: size, height: size, borderRadius: size / 2, padding: b, backgroundColor: vip ? '#168AF7' : '#FFFFFF' }, ring && s.shadow]}>
        <MaskAvatar seed={seed} size={inner} name={name} />
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
  shadow: { shadowColor: '#172339', shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  dot: { position: 'absolute', right: 0, bottom: 0, backgroundColor: '#2FBF8A', borderWidth: 2, borderColor: '#FFFFFF' },
});
