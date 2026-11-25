import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AiPortrait } from '@/components/AiPortrait';
import { Float } from '@/components/Effects';
import { Screen, StackHeader } from '@/components/Screen';
import { ErrorState, T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { traitsOf, useAiCharacters } from '@/features/ai/useAiCharacters';
import { getAiQuota, getMyAiConversations } from '@/services/api';
import { haptic } from '@/utils/format';

/** AI Characters — fictional personalities, always labelled as AI. */
export default function AiCharacters() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { list, error, reload } = useAiCharacters();
  const [recent, setRecent] = useState<Record<string, string | null>>({});
  const [quota, setQuota] = useState<{ used: number; msg_limit: number } | null>(null);
  useFocusEffect(useCallback(() => {
    getMyAiConversations().then((r) => setRecent(Object.fromEntries(r.map((c) => [c.character_id, c.last_message])))).catch(() => {});
    getAiQuota().then(setQuota).catch(() => {});
  }, []));
  const w = (width - spacing.md * 2 - 12) / 2;

  return (
    <Screen edges={['top', 'bottom']}>
      <StackHeader title="Virtual Characters" />
      {error ? <ErrorState message="Could not load the characters." onRetry={reload} /> : !list ? <ActivityIndicator color={colors.primaryDeep} style={{ marginTop: 60 }} /> : (
        <FlatList data={list} keyExtractor={(c) => c.id} numColumns={2} columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ padding: spacing.md, gap: 12, paddingBottom: 40 }}
          ListHeaderComponent={
            <View style={s.note}>
              <Ionicons name="sparkles" size={18} color={colors.text} />
              <View style={{ flex: 1 }}>
                <T style={{ fontFamily: fonts.bold }}>Fictional AI-powered characters</T>
                <T v="caption" color={colors.textSecondary}>They are not real people. Chat for fun, ideas or language practice — in Arabic, French, English or Spanish.{quota ? ` ${Math.max(0, quota.msg_limit - quota.used)} of ${quota.msg_limit} AI messages left today.` : ''}</T>
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).springify().damping(18)}>
              <Float index={index} amplitude={3}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, AI ${item.role}`} onPress={() => { haptic.tap(); router.push({ pathname: '/ai/[id]', params: { id: item.id } }); }} style={[s.card, { width: w }]}>
                  <View>
                    <LinearGradient colors={[`${item.accent}22`, `${item.accent}66`]} style={{ width: w, height: w * 1.12, alignItems: 'center', justifyContent: 'flex-end' }}>
                      <AiPortrait seed={item.avatar_seed} portrait={item.portrait_url} accent={item.accent} size={w} rounded="card" style={{ marginBottom: -1 }} />
                    </LinearGradient>
                    {recent[item.id] !== undefined && <View style={s.cont}><Ionicons name="chatbubble-ellipses" size={11} color="#fff" /></View>}
                  </View>
                  <View style={{ paddingHorizontal: 10, paddingTop: 8 }}>
                    <Text style={s.name}>{item.name}</Text>
                    <Text style={s.role} numberOfLines={1}>{item.role} · {item.tagline}</Text>
                  </View>
                  <View style={s.chips}>
                    {traitsOf(item.personality).slice(0, 2).map((t) => <View key={t} style={[s.chip, { backgroundColor: `${item.accent}1A` }]}><Text style={s.chipText} numberOfLines={1}>{t}</Text></View>)}
                    <View style={s.chip}><Text style={s.chipText}>{item.languages.map((l) => l.toUpperCase()).join(' · ')}</Text></View>
                  </View>
                </Pressable>
              </Float>
            </Animated.View>
          )} />
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  role: { fontFamily: fonts.medium, fontSize: 12, color: colors.textMuted },
  cont: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.coral, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, padding: 8 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, backgroundColor: colors.bg, maxWidth: '100%' },
  chipText: { fontFamily: fonts.medium, fontSize: 11, color: colors.textSecondary },
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 20, backgroundColor: colors.cream, marginBottom: 4 },
  card: { overflow: 'hidden', borderRadius: 20, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, shadowColor: '#172339', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  name: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, letterSpacing: -0.3 },
});
