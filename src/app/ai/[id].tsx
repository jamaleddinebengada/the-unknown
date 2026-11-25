import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { AiBadge, AiPortrait } from '@/components/AiPortrait';
import { Screen, StackHeader } from '@/components/Screen';
import { ErrorState, GradientButton, T } from '@/components/ui';
import { interestLabel } from '@/constants/content';
import { colors, fonts, spacing } from '@/constants/theme';
import { LANG_LABEL, useAiCharacters } from '@/features/ai/useAiCharacters';

/** AI character profile. */
export default function AiCharacterProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { list, error, reload } = useAiCharacters();
  const c = list?.find((x) => x.id === id);
  const chat = (starter?: string) => router.push({ pathname: '/ai/chat/[id]', params: starter ? { id: id!, starter } : { id: id! } });

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Virtual Character" />
      {error ? <ErrorState message="Could not load this character." onRetry={reload} /> : !list ? <ActivityIndicator color={colors.primaryDeep} style={{ marginTop: 60 }} /> : !c ? <ErrorState message="This character is not available." /> : (
        <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: 40 }}>
          <Animated.View entering={ZoomIn.springify().damping(14)} style={{ alignItems: 'center' }}>
            <AiPortrait seed={c.avatar_seed} accent={c.accent} size={220} rounded="card" badge={false} />
          </Animated.View>
          <View style={{ alignItems: 'center', gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={s.name}>{c.name}</Text><AiBadge /></View>
            <T color={colors.textSecondary}>{c.role} · {c.tagline}</T>
          </View>
          <View style={s.notice}><T v="caption" color={colors.text} style={{ textAlign: 'center' }}>{c.name} is a fictional AI character, not a real person.</T></View>
          <Animated.View entering={FadeInDown.delay(80)} style={s.card}>
            <Section title="About">{c.bio}</Section>
            <Section title="Personality">{c.personality}</Section>
            <Section title="Conversation style">{c.style}</Section>
            <T v="overline" color={colors.textMuted}>INTERESTS</T>
            <View style={s.chips}>{c.interests.map((i) => <View key={i} style={s.chip}><T v="caption" style={{ fontFamily: fonts.semibold }}>{interestLabel(i)}</T></View>)}</View>
            <T v="overline" color={colors.textMuted}>LANGUAGES</T>
            <View style={s.chips}>{c.languages.map((l) => <View key={l} style={[s.chip, { backgroundColor: colors.sky }]}><T v="caption" style={{ fontFamily: fonts.semibold }}>{LANG_LABEL[l] ?? l}</T></View>)}</View>
          </Animated.View>
          <T v="section">Start with…</T>
          {c.starters.map((st) => (
            <Pressable key={st} accessibilityRole="button" onPress={() => chat(st)} style={s.starter}>
              <T style={{ flex: 1 }}>{st}</T>
              <T color={colors.coral} style={{ fontFamily: fonts.bold }}>→</T>
            </Pressable>
          ))}
          <GradientButton label={`Chat with ${c.name}`} icon="chatbubbles" onPress={() => chat()} />
        </ScrollView>
      )}
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={{ gap: 4 }}>
      <T v="overline" color={colors.textMuted}>{title.toUpperCase()}</T>
      <T>{children}</T>
    </View>
  );
}

const s = StyleSheet.create({
  name: { fontFamily: fonts.extrabold, fontSize: 30, letterSpacing: -0.8, color: colors.text },
  notice: { alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.cream },
  card: { gap: 12, padding: spacing.md, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.cream },
  starter: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 18, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border },
});
