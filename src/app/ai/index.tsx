import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AiPortrait } from '@/components/AiPortrait';
import { Float } from '@/components/Effects';
import { Screen, StackHeader } from '@/components/Screen';
import { ErrorState, T } from '@/components/ui';
import { colors, fonts, spacing } from '@/constants/theme';
import { useAiCharacters } from '@/features/ai/useAiCharacters';
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
                <T v="caption" color={colors.textSecondary}>They are not real people. Chat for fun, ideas or language practice — in Arabic, French or English.{quota ? ` ${Math.max(0, quota.msg_limit - quota.used)} of ${quota.msg_limit} AI messages left today.` : ''}</T>
              </View>
            </View>
          }
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 45).springify().damping(18)}>
              <Float index={index} amplitude={3}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, AI ${item.role}`} onPress={() => { haptic.tap(); router.push({ pathname: '/ai/[id]', params: { id: item.id } }); }} style={[s.card, { width: w }]}>
                  <AiPortrait seed={item.avatar_seed} portrait={item.portrait_url} accent={item.accent} size={w - 20} rounded="card" />
                  <View style={{ gap: 2, paddingHorizontal: 2 }}>
                    <Text style={s.name}>{item.name}</Text>
                    <T v="caption" color={colors.textSecondary} numberOfLines={1}>{item.role}</T>
                    {recent[item.id] !== undefined && <T v="caption" color={colors.coral} numberOfLines={1} style={{ fontFamily: fonts.semibold }}>Continue chat</T>}
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
  note: { flexDirection: 'row', gap: 10, padding: 14, borderRadius: 20, backgroundColor: colors.cream, marginBottom: 4 },
  card: { padding: 10, gap: 8, borderRadius: 24, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, shadowColor: '#172339', shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 3 },
  name: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, letterSpacing: -0.3 },
});
