import { LinearGradient } from 'expo-linear-gradient';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInRight } from 'react-native-reanimated';
import { GlowRing } from '@/components/Effects';
import { EmojiAvatar, OrbitBackdrop } from '@/components/Illustrations3D';
import { PremiumBadge, T } from '@/components/ui';
import { interestLabel, LANGUAGES } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { unknownName } from '@/utils/format';

const INTEREST_ART: Record<string, { emoji: string; colors: [string, string] }> = {
  travel: { emoji: '🛣️', colors: ['#F59E0B', '#B45309'] }, business: { emoji: '💼', colors: ['#64748B', '#334155'] },
  technology: { emoji: '🤖', colors: ['#38BDF8', '#1D4ED8'] }, relationships: { emoji: '💞', colors: ['#F472B6', '#BE185D'] },
  life: { emoji: '🌿', colors: ['#34D399', '#047857'] }, psychology: { emoji: '🧠', colors: ['#C084FC', '#7E22CE'] },
  adventure: { emoji: '🏔️', colors: ['#60A5FA', '#1E3A8A'] }, music: { emoji: '🎸', colors: ['#A16207', '#451A03'] },
  movies: { emoji: '🎬', colors: ['#F87171', '#7F1D1D'] }, gaming: { emoji: '🎮', colors: ['#8B5CF6', '#3730A3'] },
  sports: { emoji: '⚽', colors: ['#22C55E', '#14532D'] }, culture: { emoji: '🏛️', colors: ['#FBBF24', '#92400E'] },
  education: { emoji: '📚', colors: ['#2DD4BF', '#115E59'] }, dreams: { emoji: '🌙', colors: ['#818CF8', '#312E81'] },
  philosophy: { emoji: '🔮', colors: ['#A78BFA', '#4C1D95'] }, mystery: { emoji: '🕵️', colors: ['#475569', '#0F172A'] },
};
const CHIP_COLORS = ['#6D28D9', '#1D4ED8', '#2563EB', '#334155', '#0E7490'];

export function ProfileHeader({ number, seed, country, age, interests, tags, languages, tagline, premium, stats, online = true }: {
  number: number; seed: string; country: string | null; age: string | null; interests: string[]; tags: string[]; languages: string[];
  tagline: string | null; premium?: boolean; stats?: { label: string; value: string | number }[]; online?: boolean;
}) {
  const { width } = useWindowDimensions();
  return (
    <Animated.View entering={FadeIn.duration(500)} style={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', paddingTop: spacing.md }}>
        <OrbitBackdrop width={width - 32} height={260} />
        <GlowRing size={176} speed={7000} thickness={3.5} colors={['#38BDF8', '#8B5CF6', '#EC4899']}>
          <View style={s.avatarHalo}>
            <EmojiAvatar seed={seed} size={150} ring={false} />
          </View>
        </GlowRing>
        {online && <View style={s.onlineDot} />}
        <View style={s.voice}><T style={{ fontSize: 13 }}>✨</T><T style={{ fontFamily: fonts.display, color: colors.success, fontSize: 14, letterSpacing: -1 }}>ıllı</T></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing.md }}>
          <T style={{ fontFamily: fonts.display, fontSize: 30, lineHeight: 36 }}>{unknownName(number)}</T>
          {premium && <PremiumBadge />}
        </View>
        <LinearGradient colors={['#6366F1', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.countryPill}>
          <T style={{ fontFamily: fonts.display, fontSize: 15 }} color={colors.white}>{flagOf(country)} {country ? countryName(country) : 'Location hidden'}{age ? ` · ${age}` : ''}</T>
        </LinearGradient>
        {tagline && <T color={colors.textSecondary} style={{ textAlign: 'center', marginTop: spacing.sm, paddingHorizontal: spacing.md, fontSize: 15.5, lineHeight: 24 }}>{tagline}</T>}
      </View>

      {stats && (
        <View style={s.stats}>
          {stats.map((st) => (
            <View key={st.label} style={s.stat}>
              <T style={{ fontFamily: fonts.display, fontSize: 22 }}>{st.value}</T>
              <T v="caption" color={colors.textMuted}>{st.label}</T>
            </View>
          ))}
        </View>
      )}

      {interests.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <T style={{ fontFamily: fonts.display, fontSize: 22 }}>{interests.length} interests</T>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {interests.map((i, idx) => {
              const art = INTEREST_ART[i] ?? { emoji: '✨', colors: ['#6D28D9', '#312E81'] as [string, string] };
              return (
                <Animated.View key={i} entering={FadeInRight.delay(idx * 60).springify()}>
                  <LinearGradient colors={art.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
                    <View pointerEvents="none" style={s.tileGloss} />
                    <T style={{ fontSize: 40 }}>{art.emoji}</T>
                    <T style={{ fontFamily: fonts.display, fontSize: 13 }} color={colors.white}>{interestLabel(i)}</T>
                  </LinearGradient>
                </Animated.View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {(tags.length > 0 || languages.length > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {tags.map((t, i) => (
            <View key={t} style={[s.chip, { backgroundColor: CHIP_COLORS[i % CHIP_COLORS.length] }]}><T style={{ fontFamily: fonts.displaySemi, fontSize: 15 }} color={colors.white}>{t}</T></View>
          ))}
          {languages.map((l) => (
            <View key={l} style={[s.chip, { backgroundColor: colors.white, borderColor: colors.surfaceBorder }]}><T style={{ fontFamily: fonts.displaySemi, fontSize: 15 }}>🗣 {LANGUAGES.find((x) => x.code === l)?.label ?? l}</T></View>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const s = StyleSheet.create({
  avatarHalo: { borderRadius: 80, shadowColor: '#8B5CF6', shadowOpacity: 0.45, shadowRadius: 24, elevation: 14 },
  onlineDot: { position: 'absolute', top: spacing.md + 132, left: '50%', marginLeft: 48, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.success, borderWidth: 4, borderColor: colors.bg },
  voice: { position: 'absolute', top: spacing.md + 104, left: '50%', marginLeft: 82, flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  countryPill: { marginTop: 6, paddingHorizontal: 22, paddingVertical: 6, borderRadius: radius.pill, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 22, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.surfaceBorder },
  tile: { width: 104, height: 120, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  tileGloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '42%', backgroundColor: 'rgba(255,255,255,0.12)' },
  chip: { paddingHorizontal: 18, height: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
});
