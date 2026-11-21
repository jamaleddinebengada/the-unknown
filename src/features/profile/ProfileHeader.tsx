import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
import { GlassCard, GlowRing, GradientText } from '@/components/Effects';
import { InterestTag, PremiumBadge, T } from '@/components/ui';
import { interestLabel, LANGUAGES } from '@/constants/content';
import { countryName, flagOf } from '@/constants/countries';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { unknownName } from '@/utils/format';

export function ProfileHeader({ number, seed, country, age, interests, tags, languages, tagline, premium, stats }: {
  number: number; seed: string; country: string | null; age: string | null; interests: string[]; tags: string[]; languages: string[];
  tagline: string | null; premium?: boolean; stats?: { label: string; value: string | number }[];
}) {
  return (
    <Animated.View entering={FadeIn.duration(500)}>
     <GlassCard accent={['#8B5CF6', '#38BDF8']} radius={radius.xl} padding={spacing.lg} glow>
     <View style={{ gap: spacing.md }}>
      <LinearGradient pointerEvents="none" colors={['rgba(109,74,255,0.35)', 'rgba(56,189,248,0.08)', 'rgba(0,0,0,0)']} style={s.heroGlow} />
      <View style={{ alignItems: 'center', gap: 10 }}>
        <GlowRing size={134} speed={8000} thickness={3}>
          <AnonymousAvatar seed={seed} size={108} />
        </GlowRing>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <GradientText text={unknownName(number)} size={24} align="center" width={240} />
          {premium && <PremiumBadge />}
        </View>
        <T color={colors.textSecondary}>{flagOf(country)} {country ? countryName(country) : 'Location hidden'}{age ? ` · ${age}` : ''}</T>
        {tagline && <T style={{ textAlign: 'center', fontStyle: 'italic' }} color={colors.violetSoft}>“{tagline}”</T>}
      </View>
      {stats && (
        <View style={s.stats}>
          {stats.map((st) => (
            <View key={st.label} style={s.stat}>
              <T v="section" style={{ fontFamily: fonts.extrabold }}>{st.value}</T>
              <T v="caption" color={colors.textMuted}>{st.label}</T>
            </View>
          ))}
        </View>
      )}
      {tags.length > 0 && (
        <View style={s.wrap}>{tags.map((t) => <InterestTag key={t} accent label={t} />)}</View>
      )}
      {interests.length > 0 && (
        <View style={{ gap: 8 }}>
          <T v="overline" color={colors.textMuted}>INTERESTS</T>
          <T>{interests.map(interestLabel).join(' · ')}</T>
        </View>
      )}
      {languages.length > 0 && (
        <View style={{ gap: 8 }}>
          <T v="overline" color={colors.textMuted}>SPEAKS</T>
          <View style={s.wrap}>{languages.map((l) => <InterestTag key={l} label={LANGUAGES.find((x) => x.code === l)?.label ?? l} />)}</View>
        </View>
      )}
     </View>
     </GlassCard>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  heroGlow: { position: 'absolute', left: -spacing.lg, right: -spacing.lg, top: -spacing.lg, height: 220 },
  stat: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(167,139,250,0.14)' },
  stats: { flexDirection: 'row', gap: 10 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
});
