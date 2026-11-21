import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown, FadeInUp, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Aurora } from '@/components/Effects';
import { AvatarStack, EmojiAvatar, GoldTitle, Sparkle, Star3D, StatusPill, Trophy } from '@/components/Illustrations3D';
import { ErrorState, IconButton, T } from '@/components/ui';
import { colors, fonts, radius, spacing } from '@/constants/theme';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/lib/supabase';
import { getActiveStrangers, getMessages, getMyChallenges, getMyConversations } from '@/services/api';
import type { ChallengeState, Message } from '@/types/models';
import { haptic } from '@/utils/format';

type IconName = keyof typeof Ionicons.glyphMap;
const ROUTE: Record<string, string> = { match: '/matches', chat: '/messages', post: '/create', interest: '/discover', reply: '/discover', like: '/discover' };

function resetIn() {
  const n = new Date();
  const m = Math.max(0, Math.round((Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1) - n.getTime()) / 60000));
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

function BonusBubble({ xp }: { xp: number }) {
  const p = useSharedValue(1);
  useEffect(() => { p.value = withRepeat(withSequence(withTiming(1.08, { duration: 700, easing: Easing.inOut(Easing.quad) }), withTiming(1, { duration: 700 })), -1); }, [p]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: p.value }] }));
  return (
    <Animated.View style={[s.bonus, a]}>
      <LinearGradient colors={['#FDBA74', '#F97316', '#EA580C']} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={s.bonusInner}>
        <T style={{ fontFamily: fonts.display, fontSize: 20, lineHeight: 22 }} color={colors.white}>+{xp}</T>
        <T style={{ fontFamily: fonts.displaySemi, fontSize: 11, lineHeight: 13 }} color={colors.white}>XP</T>
      </LinearGradient>
    </Animated.View>
  );
}

export default function Challenges() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile } = useAuth();
  const [state, setState] = useState<ChallengeState | null>(null);
  const [preview, setPreview] = useState<Message[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [active, setActive] = useState<Awaited<ReturnType<typeof getActiveStrangers>>>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [ch, convs, act] = await Promise.all([getMyChallenges(), getMyConversations().catch(() => []), getActiveStrangers(6).catch(() => [])]);
      setState(ch); setActive(act); setError(null);
      const latest = convs.find((c) => !c.ended);
      if (latest) {
        setChatId(latest.conversation_id);
        const msgs = await getMessages(latest.conversation_id).catch(() => []);
        setPreview(msgs.filter((m) => m.kind === 'text' || m.kind === 'prompt').slice(0, 4).reverse());
      }
    } catch (e) { setError(friendlyError(e)); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const titleSize = Math.min(32, (width - 40) / 10.5);
  const ch = (k: string) => state?.challenges.find((c) => c.key === k);
  const rest = state?.challenges.filter((c) => !['match', 'chat'].includes(c.key)) ?? [];
  const allDone = !!state && state.challenges.every((c) => c.done);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Aurora variant="warm" stars={24} />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.xs, paddingHorizontal: spacing.md, paddingBottom: insets.bottom + 40, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.violet} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <IconButton label="Back" name="chevron-back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/discover'))} />
          <View style={{ flex: 1, alignItems: 'center' }}><StatusPill label="THE UNKNOWN" live={false} /></View>
          <View style={{ width: 42 }} />
        </View>

        <View style={{ alignItems: 'center' }}>
          <Star3D size={34} style={{ position: 'absolute', right: 4, top: -6 }} />
          <Star3D size={24} delay={600} style={{ position: 'absolute', left: 10, top: titleSize * 1.4 }} />
          <Sparkle size={14} style={{ position: 'absolute', left: 4, top: 0 }} />
          <Sparkle size={12} color="#A5B4FC" delay={500} style={{ position: 'absolute', right: 26, top: titleSize * 2.6 }} />
          <GoldTitle lines={['EARN POINTS', 'BY WINNING', 'YOUR CHALLENGES!']} size={titleSize} width={width - 32} pinkLast />
          <T color={colors.textSecondary} style={{ textAlign: 'center', marginTop: 4 }}>Complete daily challenges and mind games to level up your mystery profile.</T>
        </View>

        {error ? <ErrorState message={error} onRetry={load} /> : !state ? <ActivityIndicator color={colors.violet} style={{ marginTop: 40 }} /> : (
          <>
            {/* reset timer / level card */}
            <Animated.View entering={FadeInDown.springify().damping(18)} style={s.card}>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                  <T style={{ fontFamily: fonts.display, fontSize: 17, color: '#D97706', letterSpacing: 0.6 }}>NEW CHALLENGES</T>
                  <T style={{ fontFamily: fonts.display, fontSize: 17 }}>{resetIn()}</T>
                </View>
                <T style={{ fontFamily: fonts.displaySemi, fontSize: 14, color: colors.violet, letterSpacing: 0.8 }}>LEVEL {state.level} · {state.xp} XP · 🔥 {state.active_days}/7 DAYS</T>
                <View style={s.bar}><LinearGradient colors={['#FDE68A', '#FBBF24', '#F59E0B']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.barFill, { width: `${Math.max(5, (state.level_xp / state.per_level) * 100)}%` }]} /></View>
                <View style={{ marginTop: 6 }}><AvatarStack seeds={active.length ? active.slice(0, 4).map((a) => a.avatar_seed) : ['s1', 's2', 's3', 's4']} size={30} /></View>
              </View>
              <Star3D size={78} />
            </Animated.View>

            {/* chat preview + bonus */}
            <Animated.View entering={FadeInDown.delay(80).springify().damping(18)}>
              <Pressable onPress={() => router.push(chatId ? { pathname: '/conversation/[id]', params: { id: chatId } } : '/matches')} style={[s.card, { flexDirection: 'column', alignItems: 'stretch', gap: 10 }]}>
                {preview.length ? preview.map((m) => (
                  <View key={m.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: m.is_mine ? 'flex-end' : 'flex-start' }}>
                    {!m.is_mine && <EmojiAvatar seed={m.sender_avatar_seed ?? 'x'} size={32} />}
                    <View style={[s.bubble, m.is_mine ? s.mine : s.theirs]}>
                      <T style={{ fontFamily: fonts.displaySemi, fontSize: 15 }} color={colors.white} numberOfLines={2}>{m.body}</T>
                    </View>
                  </View>
                )) : (
                  <>
                    <View style={{ alignItems: 'flex-end' }}><View style={[s.bubble, s.mine]}><T style={{ fontFamily: fonts.displaySemi, fontSize: 15 }} color={colors.white}>Ready to meet someone?</T></View></View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><EmojiAvatar seed="guide" size={32} /><View style={[s.bubble, s.theirs]}><T style={{ fontFamily: fonts.displaySemi, fontSize: 15 }} color={colors.white}>Let’s start! ✨</T></View></View>
                  </>
                )}
                <View style={s.inputMock}><T color={colors.textMuted}>{chatId ? 'Continue the conversation…' : 'Find a stranger to start chatting…'}</T></View>
                <View style={{ position: 'absolute', right: -8, bottom: -14 }}><BonusBubble xp={ch('chat')?.xp ?? 30} /></View>
              </Pressable>
            </Animated.View>

            {/* start a discussion */}
            <Animated.View entering={FadeInDown.delay(140).springify().damping(18)}>
              <Pressable onPress={() => { haptic.tap(); router.push('/messages'); }} style={[s.card, { paddingVertical: 16 }]}>
                <Ionicons name="checkmark-done" size={26} color={ch('chat')?.done ? colors.success : colors.textMuted} />
                <T style={{ fontFamily: fonts.display, fontSize: 18, flex: 1 }}>Start a discussion</T>
                <T style={{ fontFamily: fonts.display, color: '#D97706' }}>+{ch('chat')?.xp}</T>
              </Pressable>
            </Animated.View>

            {/* two-card grid */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Animated.View entering={FadeInUp.delay(180).springify()} style={{ flex: 1 }}>
                <Pressable onPress={() => router.push('/matches')} style={{ flex: 1 }}>
                  <LinearGradient colors={['#0F766E', '#134E5E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
                    <T style={{ fontFamily: fonts.display, fontSize: 17 }} color={colors.white}>Discover{'\n'}a stranger</T>
                    <View style={[s.bigCheck, !ch('match')?.done && { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                      <Ionicons name={ch('match')?.done ? 'checkmark' : 'planet'} size={24} color={colors.white} />
                    </View>
                    <T v="caption" color="rgba(255,255,255,0.8)">{ch('match')?.done ? 'Done today' : `+${ch('match')?.xp} XP`}</T>
                  </LinearGradient>
                </Pressable>
              </Animated.View>
              <Animated.View entering={FadeInUp.delay(240).springify()} style={{ flex: 1 }}>
                <LinearGradient colors={['#7C3AED', '#4C1D95']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.tile}>
                  <T style={{ fontFamily: fonts.display, fontSize: 17 }} color={colors.white}>{allDone ? 'Bravo\nchampion!' : 'Become\nchampion'}</T>
                  <View style={{ position: 'absolute', right: 8, top: 18 }}><Trophy size={52} /></View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto' }}>
                    <EmojiAvatar seed={profile?.avatar_seed ?? 'me'} size={28} />
                    <T style={{ fontFamily: fonts.display, fontSize: 12, lineHeight: 14 }} color={colors.white}>UNKNOWN{'\n'}#{profile?.unknown_number}</T>
                  </View>
                </LinearGradient>
              </Animated.View>
            </View>

            {/* remaining challenges */}
            {rest.map((c, i) => (
              <Animated.View key={c.key} entering={FadeInDown.delay(280 + i * 50).springify()}>
                <Pressable disabled={c.done} onPress={() => { haptic.tap(); router.push(ROUTE[c.key] as never); }} style={[s.card, { paddingVertical: 12 }, c.done && { borderColor: 'rgba(52,211,153,0.5)' }]}>
                  <View style={[s.icon, c.done && { backgroundColor: colors.success }]}><Ionicons name={(c.done ? 'checkmark' : c.icon) as IconName} size={18} color={c.done ? '#05301F' : colors.white} /></View>
                  <View style={{ flex: 1 }}>
                    <T style={{ fontFamily: fonts.display, fontSize: 16 }}>{c.title}</T>
                    <T v="caption" color={colors.textSecondary}>{c.done ? 'Completed today' : c.subtitle}</T>
                  </View>
                  <View style={s.reward}><T style={{ fontFamily: fonts.display, fontSize: 13, color: '#3B2300' }}>+{c.xp}</T></View>
                </Pressable>
              </Animated.View>
            ))}

            {/* active strangers */}
            <View style={[s.card, { flexDirection: 'column', alignItems: 'stretch', gap: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <T style={{ fontFamily: fonts.display, fontSize: 18, flex: 1 }}>Active strangers</T>
                <T>⭐ 👥</T>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
                <Pressable onPress={() => router.push('/matches')}>
                  <LinearGradient colors={['#A855F7', '#7C3AED']} style={s.join}><T style={{ fontFamily: fonts.display, fontSize: 15 }} color={colors.white}>Join</T></LinearGradient>
                </Pressable>
                {active.length ? active.map((a, i) => (
                  <Pressable key={a.unknown_number} onPress={() => router.push({ pathname: '/user/[number]', params: { number: String(a.unknown_number) } })}
                    style={[s.chip, { borderColor: i % 2 ? '#3B82F6' : '#10B981' }]}>
                    <EmojiAvatar seed={a.avatar_seed} size={26} ring={false} />
                    <T style={{ fontFamily: fonts.display, fontSize: 12, lineHeight: 14 }}>UNKNOWN{'\n'}<T style={{ fontFamily: fonts.display, fontSize: 12, color: a.online ? colors.success : colors.textSecondary }}>#{a.unknown_number}</T></T>
                  </Pressable>
                )) : <T v="caption" color={colors.textMuted}>No one else is active right now. Be the first!</T>}
              </ScrollView>
            </View>
            <T v="caption" color={colors.textMuted} style={{ textAlign: 'center' }}>Points are earned automatically from what you do in the app.</T>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: spacing.md, borderRadius: 26, backgroundColor: colors.white, borderWidth: 1.5, borderColor: colors.surfaceBorder, shadowColor: '#4C3FB8', shadowOpacity: 0.08, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  bar: { height: 8, borderRadius: 4, backgroundColor: colors.elevated, overflow: 'hidden', marginTop: 4 },
  barFill: { height: '100%', borderRadius: 4 },
  bubble: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, maxWidth: '75%' },
  mine: { backgroundColor: '#2563EB' },
  theirs: { backgroundColor: '#7C3AED' },
  inputMock: { height: 46, borderRadius: 16, paddingHorizontal: 16, justifyContent: 'center', borderWidth: 1, borderColor: colors.surfaceBorder, backgroundColor: colors.bg },
  bonus: { width: 74, height: 74, borderRadius: 37, padding: 4, backgroundColor: '#3B82F6', shadowColor: '#3B82F6', shadowOpacity: 0.9, shadowRadius: 16, elevation: 12 },
  bonusInner: { flex: 1, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  tile: { minHeight: 150, borderRadius: 26, padding: spacing.md, gap: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },
  bigCheck: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.success, alignItems: 'center', justifyContent: 'center' },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7C6CFF' },
  reward: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: '#FDE68A', borderWidth: 1.5, borderColor: '#FFFFFF' },
  join: { paddingHorizontal: 18, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 10, height: 48, borderRadius: radius.pill, borderWidth: 1.5, backgroundColor: colors.white },
});
