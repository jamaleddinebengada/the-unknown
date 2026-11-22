import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Extrapolation, FadeIn, FadeInDown, interpolate, useAnimatedStyle, useSharedValue, ZoomIn, type SharedValue } from 'react-native-reanimated';
import { MaskAvatar } from '@/components/PersonAvatar';
import { Scenery } from '@/components/Scenery';
import { PremiumBadge, T } from '@/components/ui';
import { interestLabel } from '@/constants/content';
import { interestArt } from '@/constants/interestArt';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, spacing } from '@/constants/theme';
import { usePersonMeta } from '@/hooks/usePersonMeta';
import { unknownName } from '@/utils/format';

/** VIP exclusive profile themes (the default "rose" is everyone's). */
export const PROFILE_THEMES: Record<string, { label: string; colors: [string, string] }> = {
  rose: { label: 'Sunshine', colors: ['#FFF1B8', '#FFD633'] },
  plum: { label: 'Coral', colors: ['#FFD3C9', '#FF806B'] },
  gold: { label: 'Champagne', colors: ['#FFF6D6', '#E5A800'] },
  ocean: { label: 'Aegean', colors: ['#EAF6FF', '#4A9CC9'] },
  sunset: { label: 'Sunset', colors: ['#FFE2D6', '#FFB547'] },
};

export function ProfileHeader({ number, seed, country, age, interests, tags, tagline, stats, online = false, theme: themeOverride, photoUrlOverride, galleryOverride, onPhotoPress, onAddGalleryPhoto, onGalleryPress, footer, scrollY }: {
  number: number; seed: string; country: string | null; age: string | null; interests: string[]; tags: string[]; languages?: string[];
  tagline: string | null; premium?: boolean; stats?: { label: string; value: string | number }[]; online?: boolean; theme?: string;
  /** own profile: show my photos even before the batched lookup returns */
  photoUrlOverride?: string | null; galleryOverride?: { url: string; path: string }[];
  onPhotoPress?: () => void; onAddGalleryPhoto?: () => void; onGalleryPress?: (path: string, url: string) => void; footer?: React.ReactNode;
  /** list scroll offset — drives the soft parallax of the cover */
  scrollY?: SharedValue<number>;
}) {
  const { width } = useWindowDimensions();
  const meta = usePersonMeta(number);
  const photo = photoUrlOverride !== undefined ? photoUrlOverride : meta?.photoUrl ?? null;
  const gallery = galleryOverride ?? (meta?.gallery ?? []).map((url) => ({ url, path: url }));
  const tier = meta?.tier ?? 'free';
  const theme = PROFILE_THEMES[themeOverride ?? meta?.theme ?? 'rose'] ?? PROFILE_THEMES.rose;
  const heroW = width - spacing.md * 2;
  const heroH = Math.min(340, heroW * 0.95);
  const tile = Math.floor((heroW - 16) / 3);
  const zero = useSharedValue(0);
  const sy = scrollY ?? zero;
  const parallax = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(sy.value, [-200, 0, 400], [-60, 0, 120], Extrapolation.CLAMP) },
      { scale: interpolate(sy.value, [-200, 0], [1.25, 1.08], Extrapolation.CLAMP) },
    ],
  }));

  return (
    <Animated.View entering={FadeIn.duration(450)} style={{ gap: spacing.md }}>
      <Pressable disabled={!onPhotoPress} onPress={onPhotoPress} accessibilityRole={onPhotoPress ? 'button' : undefined} accessibilityLabel={onPhotoPress ? 'Change profile photo' : undefined}
        style={[s.hero, { height: heroH }]}>
        {photo ? (
          <Animated.View entering={FadeIn.duration(500)} style={[StyleSheet.absoluteFill, parallax]}>
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} accessibilityLabel="Profile photo" />
          </Animated.View>
        ) : (
          <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
            <Animated.View style={[StyleSheet.absoluteFill, parallax]}><Scenery width={heroW} height={heroH} flowers="both" /></Animated.View>
            <LinearGradient colors={[`${theme.colors[0]}33`, `${theme.colors[1]}44`]} style={StyleSheet.absoluteFill} />
            <Animated.View entering={ZoomIn.springify().damping(12)} style={s.maskWrap}><MaskAvatar seed={seed} size={128} /></Animated.View>
          </View>
        )}
        <LinearGradient colors={['rgba(255,254,250,0)', 'rgba(255,254,250,0.35)']} style={[StyleSheet.absoluteFill, { top: '60%' }]} />
        {onPhotoPress && (
          <View style={s.camera}><Ionicons name="camera" size={18} color={colors.violetDeep} /><T v="caption" style={{ fontFamily: fonts.semibold }}>{photo ? 'Edit photo' : 'Add your photo'}</T></View>
        )}
        {online && <View style={s.online}><View style={s.onlineDot} /><T v="caption" color={colors.text} style={{ fontFamily: fonts.semibold }}>Online</T></View>}
      </Pressable>

      <Animated.View entering={FadeInDown.delay(80).springify().damping(18)} style={s.card}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[s.name, { flexShrink: 1 }]}>{unknownName(number)}</Text>
          {tier !== 'free' && <PremiumBadge label={tier === 'vip' ? 'VIP' : 'PLUS'} />}
        </View>
        <T v="caption" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          {flagOf(country)} {country ? countryName(country) : 'Location hidden'}{age ? ` · ${age}` : ''}
        </T>
        {tagline && <Text style={s.quote}>“{tagline}”</Text>}
        {stats && (
          <View style={s.stats}>
            {stats.map((st, i) => (
              <View key={st.label} style={[s.stat, i > 0 && s.statSep]}>
                <Text style={s.statValue}>{st.value}</Text>
                <T v="caption" color={colors.textMuted}>{st.label}</T>
              </View>
            ))}
          </View>
        )}
        {footer}
        {(interests.length > 0 || tags.length > 0) && (
          <View style={s.chips}>
            {interests.map((i) => (
              <View key={i} style={s.chip}><Text style={{ fontSize: 13 }}>{interestArt(i).emoji}</Text><Text style={s.chipText}>{interestLabel(i)}</Text></View>
            ))}
            {tags.map((t) => <View key={t} style={[s.chip, { backgroundColor: colors.blush }]}><Text style={s.chipText}>{t}</Text></View>)}
          </View>
        )}
      </Animated.View>

      {(gallery.length > 0 || onAddGalleryPhoto) && (
        <View style={{ gap: spacing.sm }}>
          <T v="section">Photos</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {gallery.map((g) => (
              <Pressable key={g.path} disabled={!onGalleryPress} onPress={() => onGalleryPress?.(g.path, g.url)} accessibilityLabel="Gallery photo">
                <Image source={{ uri: g.url }} style={{ width: tile, height: tile, borderRadius: 18 }} contentFit="cover" transition={250} />
              </Pressable>
            ))}
            {onAddGalleryPhoto && gallery.length < 6 && (
              <Pressable onPress={onAddGalleryPhoto} accessibilityRole="button" accessibilityLabel="Add a photo to your gallery" style={[s.addTile, { width: tile, height: tile }]}>
                <Ionicons name="add" size={28} color={colors.violet} />
              </Pressable>
            )}
          </View>
        </View>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  hero: { borderRadius: 30, overflow: 'hidden', backgroundColor: colors.blush, shadowColor: '#25324A', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  maskWrap: { position: 'absolute', padding: 5, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.85)' },
  camera: { position: 'absolute', right: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  online: { position: 'absolute', left: 12, top: 12, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.92)' },
  onlineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },
  card: { marginTop: -46, marginHorizontal: 6, padding: spacing.lg, gap: 8, borderRadius: 28, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder, shadowColor: '#25324A', shadowOpacity: 0.1, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  name: { fontFamily: fonts.bold, fontSize: 26, letterSpacing: -0.5, color: colors.text },
  quote: { fontFamily: fonts.serifItalic, fontSize: 16.5, lineHeight: 24, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
  stats: { flexDirection: 'row', marginTop: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statSep: { borderLeftWidth: 1, borderLeftColor: colors.hairline },
  statValue: { fontFamily: fonts.bold, fontSize: 21, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.ivory, borderWidth: 1, borderColor: colors.surfaceBorder },
  chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.violetDeep },
  addTile: { borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.violetSoft, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});
