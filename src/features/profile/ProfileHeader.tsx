import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { AnonymousAvatar } from '@/components/AnonymousAvatar';
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
    <Animated.View entering={FadeIn.duration(400)} style={s.card}>
      <LinearGradient colors={['rgba(109,74,255,0.28)', 'rgba(22,27,43,0)']} style={StyleSheet.absoluteFill} />
      <View style={{ alignItems: 'center', gap: 10 }}>
        <AnonymousAvatar seed={seed} size={104} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <T v="section" style={{ fontFamily: fonts.bold, letterSpacing: 0.6 }}>{unknownName(number)}</T>
          {premium && <PremiumBadge />}
        </View>
        <T color={colors.textSecondary}>{flagOf(country)} {country ? countryName(country) : 'Location hidden'}{age ? ` · ${age}` : ''}</T>
        {tagline && <T style={{ textAlign: 'center', fontStyle: 'italic' }} color={colors.violetSoft}>“{tagline}”</T>}
      </View>
      {stats && (
        <View style={s.stats}>
          {stats.map((st) => (
            <View key={st.label} style={{ alignItems: 'center', flex: 1 }}>
              <T v="cardTitle">{st.value}</T>
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
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.hairline },
  stats: { flexDirection: 'row', paddingVertical: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.hairlineStrong },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
});
